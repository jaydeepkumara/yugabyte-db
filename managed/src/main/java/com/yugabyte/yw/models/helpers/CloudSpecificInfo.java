// Copyright (c) YugaByte, Inc.

package com.yugabyte.yw.models.helpers;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

/**
 * Represents all the details of a node that are got from the cloud provider.
 *
 * <p>NOTE: the names of fields in this class MUST correspond to the output field names of the
 * script 'yb_inventory.py' which is in the 'devops' repository.
 */
@ApiModel(value = "Cloud specific info", description = "Cloud specific information")
public class CloudSpecificInfo {
  // The private ip address
  @ApiModelProperty(value = "Private IP")
  public String private_ip = null;

  // The public ip address.
  @ApiModelProperty(value = "Public IP")
  public String public_ip = null;

  // The public dns name of the node.
  @ApiModelProperty(value = "Public DNS")
  public String public_dns = null;

  // The private dns name of the node.
  @ApiModelProperty(value = "Private DNS")
  public String private_dns = null;

  // Type of the node (example: c3.xlarge on aws).
  @ApiModelProperty(value = "Instance type")
  public String instance_type = null;

  // The id of the subnet into which this node is deployed.
  @ApiModelProperty(value = "Subnet IP")
  public String subnet_id = null;

  // The az into which the node is deployed.
  @ApiModelProperty(value = "AZ")
  public String az = null;

  // The region into which the node is deployed.
  @ApiModelProperty(value = "Region")
  public String region = null;

  // The cloud provider where the node is located.
  @ApiModelProperty(value = "Cloud")
  public String cloud = null;

  @ApiModelProperty(value = "Public IP assigned")
  public boolean assignPublicIP = true;

  @ApiModelProperty(value = "Is use time sync enable")
  public boolean useTimeSync = false;

  @ApiModelProperty(value = "Mount roots")
  public String mount_roots;

  public CloudSpecificInfo() {}

  @Override
  public CloudSpecificInfo clone() {
    CloudSpecificInfo cloudInfo = new CloudSpecificInfo();
    cloudInfo.private_ip = private_ip;
    cloudInfo.public_ip = public_ip;
    cloudInfo.public_dns = public_dns;
    cloudInfo.private_dns = private_dns;
    cloudInfo.instance_type = instance_type;
    cloudInfo.subnet_id = subnet_id;
    cloudInfo.az = az;
    cloudInfo.region = region;
    cloudInfo.cloud = cloud;
    cloudInfo.assignPublicIP = assignPublicIP;
    cloudInfo.mount_roots = mount_roots;
    return cloudInfo;
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("cloudInfo: ")
        .append(az)
        .append(".")
        .append(region)
        .append(".")
        .append(cloud)
        .append(", type: ")
        .append(instance_type)
        .append(", ip: ")
        .append(private_ip);
    if (mount_roots != null && !mount_roots.isEmpty()) {
      sb.append(", mountRoots: ").append(mount_roots);
    }
    return sb.toString();
  }
}
