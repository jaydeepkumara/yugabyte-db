/*
 * Copyright 2021 YugaByte, Inc. and Contributors
 *
 * Licensed under the Polyform Free Trial License 1.0.0 (the "License"); you
 * may not use this file except in compliance with the License. You
 * may obtain a copy of the License at
 *
 * http://github.com/YugaByte/yugabyte-db/blob/master/licenses/POLYFORM-FREE-TRIAL-LICENSE-1.0.0.txt
 */
package com.yugabyte.yw.common.alerts;

import com.yugabyte.yw.common.templates.PlaceholderSubstitutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class AlertTemplateSubstitutor<T extends AlertLabelsProvider>
    extends PlaceholderSubstitutor {

  private static final Logger LOG = LoggerFactory.getLogger(AlertTemplateSubstitutor.class);

  private static final String LABELS_PREFIX = "$labels.";

  public AlertTemplateSubstitutor(T instance) {
    super(
        key -> {
          if (key.startsWith(LABELS_PREFIX)) {
            String labelName = key.replace(LABELS_PREFIX, "");
            String labelValue = instance.getLabelValue(labelName);
            if (labelValue == null) {
              LOG.trace("Label {} not found in object {}", labelName, instance.getUuid());
              return "{{ " + key + " }}";
            }

            return labelValue;
          }
          LOG.trace("Unexpected placeholder {} in object {}", key, instance.getUuid());
          return "{{ " + key + " }}";
        });
  }
}
