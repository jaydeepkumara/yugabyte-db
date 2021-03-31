// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
//
// The following only applies to changes made to this file as part of YugaByte development.
//
// Portions Copyright (c) YugaByte, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distributed under the License
// is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied.  See the License for the specific language governing permissions and limitations
// under the License.

#ifndef YB_MASTER_SCOPED_LEADER_SHARED_LOCK_H
#define YB_MASTER_SCOPED_LEADER_SHARED_LOCK_H

#include <chrono>

#include <glog/logging.h>

#include "yb/util/status.h"
#include "yb/rpc/rpc_context.h"
#include "yb/util/rw_mutex.h"
#include "yb/util/shared_lock.h"

namespace yb {
namespace master {

class CatalogManager;

// This is how we should instantiate ScopedLeaderSharedLock. Captures context information so we can
// use it in logging and debugging.
#define SCOPED_LEADER_SHARED_LOCK(lock_name, catalog_manager) \
    ::yb::master::ScopedLeaderSharedLock lock_name( \
        (catalog_manager), __FILE__, __LINE__, __func__)

// Scoped "shared lock" to serialize master leader elections.
//
// While in scope, blocks the catalog manager in the event that it becomes
// the leader of its Raft configuration and needs to reload its persistent
// metadata. Once destroyed, the catalog manager is unblocked.
//
// Usage:
//
// void MasterServiceImpl::CreateTable(const CreateTableRequestPB* req,
//                                     CreateTableResponsePB* resp,
//                                     rpc::RpcContext* rpc) {
//   ScopedLeaderSharedLock l(server_->catalog_manager());
//   if (!l.CheckIsInitializedAndIsLeaderOrRespond(resp, rpc)) {
//     return;
//   }
//
//   Status s = server_->catalog_manager()->CreateTable(req, resp, rpc);
//   CheckRespErrorOrSetUnknown(s, resp);
//   rpc.RespondSuccess();
// }
//
class ScopedLeaderSharedLock {
 public:
  // Creates a new shared lock, acquiring the catalog manager's leader_lock_
  // for reading in the process. The lock is released when this object is
  // destroyed.
  //
  // 'catalog' must outlive this object.
  explicit ScopedLeaderSharedLock(
      CatalogManager* catalog,
      const char* file_name,
      int line_number,
      const char* function_name);

  ~ScopedLeaderSharedLock() { Unlock(); }

  void Unlock();

  // General status of the catalog manager. If not OK (e.g. the catalog
  // manager is still being initialized), all operations are illegal and
  // leader_status() should not be trusted.
  const Status& catalog_status() const { return catalog_status_; }

  // Leadership status of the catalog manager. If not OK, the catalog
  // manager is not the leader, but some operations may still be legal.
  const Status& leader_status() const {
    DCHECK(catalog_status_.ok());
    return leader_status_;
  }

  // First non-OK status of the catalog manager, adhering to the checking
  // order specified above.
  const Status& first_failed_status() const {
    if (!catalog_status_.ok()) {
      return catalog_status_;
    }
    return leader_status_;
  }

  // Check that the catalog manager is initialized. It may or may not be the
  // leader of its Raft configuration.
  //
  // If not initialized, writes the corresponding error to 'resp',
  // responds to 'rpc', and returns false.
  template<typename RespClass>
  bool CheckIsInitializedOrRespond(RespClass* resp, rpc::RpcContext* rpc);

  // Check that the catalog manager is initialized and that it is the leader
  // of its Raft configuration. Initialization status takes precedence over
  // leadership status.
  //
  // If not initialized or if not the leader, writes the corresponding error
  // to 'resp', responds to 'rpc', and returns false.
  template<typename RespClass>
  bool CheckIsInitializedAndIsLeaderOrRespond(RespClass* resp, rpc::RpcContext* rpc);

  // TServer API variant of above class to set appropriate error codes.
  template<typename RespClass>
  bool CheckIsInitializedAndIsLeaderOrRespondTServer(RespClass* resp, rpc::RpcContext* rpc);

  // If set_error is false, then the error field of resp should not be set.
  template<typename RespClass>
  bool CheckIsInitializedOrRespondTServer(RespClass* resp, rpc::RpcContext* rpc,
                                          bool set_error = true);

 private:
  template<typename RespClass, typename ErrorClass>
  bool CheckIsInitializedAndIsLeaderOrRespondInternal(RespClass* resp, rpc::RpcContext* rpc);

  template<typename RespClass, typename ErrorClass>
  bool CheckIsInitializedOrRespondInternal(RespClass* resp, rpc::RpcContext* rpc,
                                           bool set_error = true);

  CatalogManager* catalog_;
  shared_lock<RWMutex> leader_shared_lock_;
  Status catalog_status_;
  Status leader_status_;
  std::chrono::steady_clock::time_point start_;

  const char* file_name_;
  int line_number_;
  const char* function_name_;
};

}  // namespace master
}  // namespace yb

#endif  // YB_MASTER_SCOPED_LEADER_SHARED_LOCK_H
