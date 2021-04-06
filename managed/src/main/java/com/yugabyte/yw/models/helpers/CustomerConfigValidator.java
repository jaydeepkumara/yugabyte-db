// Copyright (c) YugaByte, Inc.

package com.yugabyte.yw.models.helpers;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.apache.commons.lang3.StringUtils;
import org.apache.commons.validator.routines.UrlValidator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.inject.Singleton;
import com.yugabyte.yw.models.CustomerConfig;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.auth.AWSCredentials;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.s3.model.Bucket;
import com.amazonaws.services.s3.model.AmazonS3Exception;
import java.util.UUID;

import play.libs.Json;

@Singleton
public class CustomerConfigValidator {

  private static final String STORAGE_TYPE = "STORAGE";

  private static final String NAME_S3 = "S3";

  private static final String NAME_GCS = "GCS";

  private static final String NAME_NFS = "NFS";

  private static final String NAME_AZURE = "AZ";

  private static final String[] S3_URL_SCHEMES = { "http", "https", "s3" };

  private static final String[] GCS_URL_SCHEMES = { "http", "https", "gs" };

  private static final String[] AZ_URL_SCHEMES = { "http", "https" };

  private static final String AWS_HOST_BASE_FIELDNAME = "AWS_HOST_BASE";

  private static final String BACKUP_LOCATION_FIELDNAME = "BACKUP_LOCATION";

  private static final String NFS_PATH_REGEXP = "^/|//|(/[\\w-]+)+$";

  private static final String S3_BUCKET_NAME = "^s3://.*";

  public static abstract class ConfigValidator {

    private final String type;

    private final String name;

    protected final String fieldName;

    public ConfigValidator(String type, String name, String fieldName) {
      this.type = type;
      this.name = name;
      this.fieldName = fieldName;
    }

    public void validate(String type, String name, JsonNode data, ObjectNode errorsCollector) {
      if (this.type.equals(type) && this.name.equals(name)) {
        JsonNode value = data.get(fieldName);
        doValidate(value == null ? "" : value.asText(), errorsCollector);
        if (this.name.equals("S3") &&
            data.get("AWS_ACCESS_KEY_ID") != null) {
          validateS3DataContent(data, errorsCollector);
        }
      }
    }

    protected abstract void doValidate(String value, ObjectNode errorsCollector);
  }

  public static class ConfigValidatorRegEx extends ConfigValidator {

    private Pattern pattern;

    public ConfigValidatorRegEx(String type, String name, String fieldName, String regex) {
      super(type, name, fieldName);
      pattern = Pattern.compile(regex);
    }

    @Override
    protected void doValidate(String value, ObjectNode errorsCollector) {
      if (!pattern.matcher(value).matches()) {
        errorsCollector.set(fieldName, Json.newArray().add("Invalid field value '" + value + "'."));
      }
    }
  }

  public static class ConfigValidatorUrl extends ConfigValidator {

    private static final String DEFAULT_SCHEME = "https://";

    private final UrlValidator urlValidator;

    private final boolean emptyAllowed;

    public ConfigValidatorUrl(String type, String name, String fieldName, String[] schemes,
        boolean emptyAllowed) {
      super(type, name, fieldName);
      this.emptyAllowed = emptyAllowed;
      urlValidator = new UrlValidator(schemes, UrlValidator.ALLOW_LOCAL_URLS);
    }

    @Override
    protected void doValidate(String value, ObjectNode errorsCollector) {
      if (StringUtils.isEmpty(value)) {
        if (!emptyAllowed) {
          errorsCollector.set(fieldName, Json.newArray().add("This field is required."));
        }
        return;
      }

      boolean valid = false;
      try {
        URI uri = new URI(value);
        valid = urlValidator
            .isValid(StringUtils.isEmpty(uri.getScheme()) ? DEFAULT_SCHEME + value : value);
      } catch (URISyntaxException e) {
      }

      if (!valid) {
        errorsCollector.set(fieldName, Json.newArray().add("Invalid field value '" + value + "'."));
      }
    }
  }

  private final List<ConfigValidator> validators = new ArrayList<>();

  public CustomerConfigValidator() {
    validators.add(new ConfigValidatorRegEx(STORAGE_TYPE, NAME_NFS, BACKUP_LOCATION_FIELDNAME,
        NFS_PATH_REGEXP));
    validators.add(new ConfigValidatorRegEx(STORAGE_TYPE, NAME_S3, BACKUP_LOCATION_FIELDNAME,
        S3_BUCKET_NAME));
    validators.add(new ConfigValidatorUrl(STORAGE_TYPE, NAME_S3, AWS_HOST_BASE_FIELDNAME,
        S3_URL_SCHEMES, true));
    validators.add(new ConfigValidatorUrl(STORAGE_TYPE, NAME_GCS, BACKUP_LOCATION_FIELDNAME,
        GCS_URL_SCHEMES, false));
    validators.add(new ConfigValidatorUrl(STORAGE_TYPE, NAME_AZURE, BACKUP_LOCATION_FIELDNAME,
        AZ_URL_SCHEMES, false));
  }

  public ObjectNode validateFormData(JsonNode formData) {
    ObjectNode errorJson = Json.newObject();
    if (!formData.hasNonNull("name")) {
      errorJson.set("name", Json.newArray().add("This field is required"));
    }
    if (!formData.hasNonNull("type")) {
      errorJson.set("type", Json.newArray().add("This field is required"));
    } else if (!CustomerConfig.ConfigType.isValid(formData.get("type").asText())) {
      errorJson.set("type", Json.newArray().add("Invalid type provided"));
    }

    if (!formData.hasNonNull("data")) {
      errorJson.set("data", Json.newArray().add("This field is required"));
    } else if (!formData.get("data").isObject()) {
      errorJson.set("data", Json.newArray().add("Invalid data provided, expected a object."));
    }
    return errorJson;
  }

  /**
   * Validates data which is contained in formData.
   * During the procedure it calls all the registered validators. Errors are collected and
   * returned back as a result. Empty result object means no errors.
   *
   * Currently are checked:
   *  - NFS - NFS Storage Path (against regexp NFS_PATH_REGEXP);
   *  - S3/AWS - S3 Bucket, S3 Bucket Host Base (both as URLs);
   *  - GCS - GCS Bucket (as URL);
   *  - AZURE - Container URL (as URL).
   *
   * The URLs validation allows empty scheme. In such case the check is made with DEFAULT_SCHEME
   * added before the URL.
   *
   * @param formData
   * @return Json filled with errors
   */
  public ObjectNode validateDataContent(JsonNode formData) {
    ObjectNode errorJson = Json.newObject();
    validators.forEach(v -> v.validate(formData.get("type").asText(), formData.get("name").asText(),
        formData.get("data"), errorJson));
    return errorJson;
  }

  /**
   * Validates data which is contained in formData.
   * During the procedure it checks all the S3 config parameters whether they are valid or not.
   * Errors are collected and
   * returned back as a result. Empty result object means no errors.
   *
   * Currently is checked:
   *  - S3/AWS - S3 Bucket, whether it exists or not.
   *
   * @param formData, region
   * @return Json filled with errors
   */
  public static ObjectNode validateS3DataContent(JsonNode formData, ObjectNode errorJson) {
    try {
      String bucketname = formData.get("BACKUP_LOCATION").asText();
      //Assuming bucket name will always start with s3:// otherwise that will be invalid
      bucketname = bucketname.substring(5);
      AmazonS3 s3client = getS3Client(formData);
      List<Bucket> buckets = s3client.listBuckets();
      for (Bucket bucket : buckets) {
        if (bucket.getName().equals(bucketname))
          return errorJson;
      }
      errorJson.set("BackupConfigException", Json.newArray().add("Bucket name " + bucketname +
          " doesn't exist"));
    } catch (AmazonS3Exception s3Exception) {
      errorJson.set("BackupConfigException", Json.newArray().add(s3Exception.getErrorMessage()));
    }
    return errorJson;
  }

  // TODO: move to some common utils or AWSCloudImpl file
  public static AmazonS3 getS3Client(JsonNode formData) {
    AWSCredentials credentials = new BasicAWSCredentials(
      formData.get("AWS_ACCESS_KEY_ID").asText(),
      formData.get("AWS_SECRET_ACCESS_KEY").asText()
    );
    return AmazonS3ClientBuilder
      .standard()
      .withCredentials(new AWSStaticCredentialsProvider(credentials))
      .withRegion(Regions.DEFAULT_REGION)
      .build();
  }
}
