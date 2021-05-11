// Copyright (c) Yugabyte, Inc.

package com.yugabyte.yw.controllers;

import java.util.List;
import java.util.UUID;

import com.yugabyte.yw.common.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.yugabyte.yw.models.Audit;
import com.yugabyte.yw.models.Customer;
import com.yugabyte.yw.models.Users;

import play.mvc.Result;

public class AuditController extends AuthenticatedController {

  public static final Logger LOG = LoggerFactory.getLogger(AuditController.class);

  /**
   * GET endpoint for listing all audit entries for a user.
   * @return JSON response with audit entries belonging to the user.
   */
  public Result list(UUID customerUUID, UUID userUUID) {
    Customer.getOrBadRequest(customerUUID);
    Users user = Users.getOrBadRequest(userUUID);

    List<Audit> auditList = Audit.getAllUserEntries(user.uuid);
    return ApiResponse.success(auditList);
  }

  /**
   * GET endpoint for getting the user associated with a task.
   * @return JSON response with the corresponding audit entry.
   */
  public Result getTaskAudit(UUID customerUUID, UUID taskUUID) {
    Customer.getOrBadRequest(customerUUID);
    Audit entry = Audit.getOrBadRequest(customerUUID, taskUUID);
    return ApiResponse.success(entry);
  }

  public Result getUserFromTask(UUID customerUUID, UUID taskUUID) {
    Customer.getOrBadRequest(customerUUID);
    Audit entry = Audit.getOrBadRequest(customerUUID, taskUUID);
    Users user = Users.get(entry.getUserUUID());
    return ApiResponse.success(user);
  }
}
