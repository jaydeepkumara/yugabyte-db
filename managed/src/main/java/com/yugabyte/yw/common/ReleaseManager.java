// Copyright (c) YugaByte, Inc.
package com.yugabyte.yw.common;

import static java.nio.file.StandardCopyOption.REPLACE_EXISTING;

import com.google.inject.Inject;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import java.io.File;
import java.io.IOException;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.PathMatcher;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import javax.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import play.Configuration;
import play.libs.Json;

@Singleton
public class ReleaseManager {

  @Inject ConfigHelper configHelper;

  @Inject Configuration appConfig;

  public enum ReleaseState {
    ACTIVE,
    DISABLED,
    DELETED
  }

  final ConfigHelper.ConfigType CONFIG_TYPE = ConfigHelper.ConfigType.SoftwareReleases;

  @ApiModel(value = "Release Data", description = "Release Data")
  public static class ReleaseMetadata {

    @ApiModelProperty(value = "Release state", example = "ACTIVE")
    public ReleaseState state = ReleaseState.ACTIVE;

    @ApiModelProperty(value = "Release notes")
    public List<String> notes;

    // File path where the release binary is stored
    @ApiModelProperty(value = "Release File path")
    public String filePath;

    // Docker image tag corresponding to the release
    @ApiModelProperty(value = "Release image tag")
    public String imageTag;

    public static ReleaseMetadata fromLegacy(String version, Object metadata) {
      // Legacy release metadata would have name and release path alone
      // convert those to new format.
      ReleaseMetadata rm = create(version);
      rm.filePath = (String) metadata;
      return rm;
    }

    public static ReleaseMetadata create(String version) {
      ReleaseMetadata rm = new ReleaseMetadata();
      rm.state = ReleaseState.ACTIVE;
      rm.imageTag = version;
      rm.notes = new ArrayList<>();
      return rm;
    }

    public String toString() {
      return getClass().getName()
          + " state: "
          + String.valueOf(state)
          + " filePath: "
          + String.valueOf(filePath)
          + " imageTag: "
          + String.valueOf(imageTag);
    }
  }

  public static final Logger LOG = LoggerFactory.getLogger(ReleaseManager.class);
  final PathMatcher ybPackageMatcher =
      FileSystems.getDefault().getPathMatcher("glob:**yugabyte*.tar.gz");
  Predicate<Path> packagesFilter = p -> Files.isRegularFile(p) && ybPackageMatcher.matches(p);

  // This regex needs to support old style packages with -ee as well as new style packages without.
  // There are previously existing YW deployments that will have the old packages and users will
  // need to still be able to use said universes and their existing YB releases.
  final Pattern ybPackagePattern = Pattern.compile("[^.]+yugabyte-(?:ee-)?(.*)-centos(.*).tar.gz");

  public Map<String, String> getLocalReleases(String localReleasePath) {
    Map<String, String> releaseMap = new HashMap<>();

    try {
      // Return a map of version# and software package
      releaseMap =
          Files.walk(Paths.get(localReleasePath))
              .filter(packagesFilter)
              .collect(
                  Collectors.toMap(
                      p -> p.getName(p.getNameCount() - 2).toString(),
                      p -> p.toAbsolutePath().toString()));
      LOG.debug("Local releases: [ {} ]", releaseMap.toString());
    } catch (IOException e) {
      LOG.error(e.getMessage());
    }
    return releaseMap;
  }

  public Map<String, Object> getReleaseMetadata() {
    Map<String, Object> releases = configHelper.getConfig(CONFIG_TYPE);
    if (releases == null || releases.isEmpty()) {
      LOG.debug("getReleaseMetadata: No releases found");
      return new HashMap<>();
    }
    releases.forEach(
        (version, metadata) -> {
          if (metadata instanceof String) {
            releases.put(version, ReleaseMetadata.fromLegacy(version, metadata));
          }
        });

    return releases;
  }

  public void addRelease(String version) {
    ReleaseMetadata metadata = ReleaseMetadata.create(version);
    addReleaseWithMetadata(version, metadata);
  }

  public void addReleaseWithMetadata(String version, ReleaseMetadata metadata) {
    Map<String, Object> currentReleases = getReleaseMetadata();
    if (currentReleases.containsKey(version)) {
      throw new RuntimeException("Release already exists: " + version);
    }
    LOG.info("Adding release version {} with metadata {}", version, metadata.toString());
    currentReleases.put(version, metadata);
    configHelper.loadConfigToDB(ConfigHelper.ConfigType.SoftwareReleases, currentReleases);
  }

  public void importLocalReleases() {
    String ybReleasesPath = appConfig.getString("yb.releases.path");
    if (ybReleasesPath != null && !ybReleasesPath.isEmpty()) {
      moveDockerReleaseFile(ybReleasesPath);
      Map<String, String> localReleases = getLocalReleases(ybReleasesPath);
      Map<String, Object> currentReleases = getReleaseMetadata();
      localReleases.keySet().removeAll(currentReleases.keySet());
      LOG.debug("Current releases: [ {} ]", currentReleases.keySet().toString());
      LOG.debug("Local releases: [ {} ]", localReleases.keySet());
      if (!localReleases.isEmpty()) {
        LOG.info("Importing local releases: [ {} ]", localReleases.keySet().toString());
        localReleases.forEach(
            (version, releaseFile) ->
                currentReleases.put(version, ReleaseMetadata.fromLegacy(version, releaseFile)));
        configHelper.loadConfigToDB(ConfigHelper.ConfigType.SoftwareReleases, currentReleases);
      }
    }
  }

  public void updateReleaseMetadata(String version, ReleaseMetadata newData) {
    Map<String, Object> currentReleases = getReleaseMetadata();
    if (currentReleases.containsKey(version)) {
      currentReleases.put(version, newData);
      configHelper.loadConfigToDB(ConfigHelper.ConfigType.SoftwareReleases, currentReleases);
    }
  }

  /**
   * This method would move the yugabyte server package that we bundle with docker image to yb
   * releases path.
   *
   * @param ybReleasesPath (str): Yugabyte releases path to create the move the files to.
   */
  private void moveDockerReleaseFile(String ybReleasesPath) {
    String ybDockerRelease = appConfig.getString("yb.docker.release");
    if (ybDockerRelease == null || ybDockerRelease.isEmpty()) {
      return;
    }

    try {
      Files.walk(Paths.get(ybDockerRelease))
          .map(String::valueOf)
          .map(ybPackagePattern::matcher)
          .filter(Matcher::matches)
          .forEach(
              match -> {
                File releaseFile = new File(match.group());
                File destinationFolder = new File(ybReleasesPath, match.group(1));
                File destinationFile = new File(destinationFolder, releaseFile.getName());
                if (!destinationFolder.exists()) {
                  destinationFolder.mkdir();
                }
                try {
                  Files.move(releaseFile.toPath(), destinationFile.toPath(), REPLACE_EXISTING);
                } catch (IOException e) {
                  throw new RuntimeException(
                      "Unable to move docker release file "
                          + releaseFile.toPath()
                          + " to "
                          + destinationFile);
                }
              });
    } catch (IOException e) {
      LOG.error(e.getMessage());
      throw new RuntimeException("Unable to look up release files in " + ybDockerRelease);
    }
  }

  public ReleaseMetadata getReleaseByVersion(String version) {
    Object metadata = getReleaseMetadata().get(version);
    if (metadata == null) {
      return null;
    }
    return Json.fromJson(Json.toJson(metadata), ReleaseMetadata.class);
  }

  public Map<String, String> getReleases() {
    return (Map) configHelper.getConfig(CONFIG_TYPE);
  }
}
