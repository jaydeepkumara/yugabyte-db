// Copyright (c) YugaByte, Inc.

package com.yugabyte.yw.models;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.EmbeddedId;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.ebean.*;
import io.ebean.annotation.DbJson;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import play.data.validation.Constraints;
import play.libs.Json;

@Entity
public class HealthCheck extends Model {
  public static final Logger LOG = LoggerFactory.getLogger(HealthCheck.class);

  public static class Details {
    public static class NodeData {
      public String node;
      public String process;
      public String timestamp;
      public String node_name;
      public Boolean has_error = false;
      public List<String> details;
      public String message;
    }

    public Date timestamp;
    public List<NodeData> data = new ArrayList<>();
    public String yb_version;
    @JsonAlias({"error", "has_error"})
    public Boolean has_error;
  }

  // The max number of records to keep per universe.
  public static final int RECORD_LIMIT = 10;

  // Top-level payload field for figuring out if we have errors or not.
  public static final String FIELD_HAS_ERROR = "has_error";

  @EmbeddedId @Constraints.Required public HealthCheckKey idKey;

  // The customer id, needed only to enforce unique universe names for a customer.
  @Constraints.Required public Long customerId;

  // The Json serialized version of the details. This is used only in read from and writing to the
  // DB.
  @DbJson
  @Constraints.Required
  @Column(columnDefinition = "TEXT", nullable = false)
  public Details detailsJson;

  public boolean hasError() {
      return detailsJson.has_error;
  }

  public static final Finder<UUID, HealthCheck> find =
      new Finder<UUID, HealthCheck>(HealthCheck.class) {};

  /**
   * Creates an empty universe.
   *
   * @param universeUUID: UUID of the universe..
   * @param customerId: UUID of the customer creating the universe.
   * @param details: The details that will describe the universe.
   * @return the newly created universe
   */
  public static HealthCheck addAndPrune(UUID universeUUID, Long customerId, String details) {
    // Create the HealthCheck object.
    HealthCheck check = new HealthCheck();
    check.idKey = HealthCheckKey.create(universeUUID);
    check.customerId = customerId;
    // Validate it is correct JSON.
    // ObjectMapper objMapper = new ObjectMapper();
    Details features =Json.fromJson(Json.parse(details), Details.class);
    // Details features = objMapper.convertValue(Json.parse(details), new TypeReference<Details>() {});
    check.detailsJson = features;
    // Save the object.
    check.save();
    keepOnlyLast(universeUUID, RECORD_LIMIT);
    return check;
  }

  public static void keepOnlyLast(UUID universeUUID, int numChecks) {
    List<HealthCheck> checks = getAll(universeUUID);
    for (int i = 0; i < checks.size() - numChecks; ++i) {
      checks.get(i).delete();
    }
  }

  /**
   * Returns the HealthCheck object for a certain universe.
   *
   * @param universeUUID
   * @return the HealthCheck object
   */
  public static List<HealthCheck> getAll(UUID universeUUID) {
    return find.query().where().eq("universe_uuid", universeUUID).orderBy("check_time").findList();
  }

  public static HealthCheck getLatest(UUID universeUUID) {
    List<HealthCheck> checks =
        find.query()
            .where()
            .eq("universe_uuid", universeUUID)
            .orderBy("check_time desc")
            .setMaxRows(1)
            .findList();
    if (checks != null && checks.size() > 0) {
      return checks.get(0);
    } else {
      return null;
    }
  }
}
