// Copyright (c) YugaByte, Inc.
//
// Author: Gaurav Raj(gauraraj@deloitte.com)
//
// This file will hold Universe alert creation and Platform
// alert creation.

import { Field, reduxForm, FieldArray } from 'redux-form';
import React, { useState, useEffect } from 'react';
import { Col, Row } from 'react-bootstrap';
import {
  YBButton,
  YBMultiSelectWithLabel,
  YBRadioButtonGroup,
  YBSelectWithLabel,
  YBTextArea,
  YBTextInputWithLabel
} from '../../common/forms/fields';
import { Formik } from 'formik';
import '../CreateAlerts.scss';
import AlertsPolicy from './AlertsPolicy';
import { getPromiseState } from '../../../utils/PromiseUtils';
import { isNonEmptyArray } from '../../../utils/ObjectUtils';

const required = (value) => (value ? undefined : 'This field is required.');

const CreateAlert = (props) => {
  const {
    enablePlatformAlert,
    onCreateCancel,
    handleSubmit,
    metricsData,
    createAlertConfig,
    alertDestionations,
    universes
  } = props;
  const [isAllUniversesDisabled, setIsAllUniversesDisabled] = useState(true);
  const [alertDestionation, setAlertDesionation] = useState([]);
  const [alertUniverseList, setAlertUniverseList] = useState([]);

  useEffect(() => {
    alertDestionations().then((res) => {
      res = res.map((destination, index) => (
        <option key={index} value={destination.uuid}>
          {destination.name}
        </option>
      ));
      setAlertDesionation(res);
    });

    if (!getPromiseState(universes).isSuccess()) {
      props.fetchUniverseList().then((data) => {
        setAlertUniverseList([
          ...data.map((universe) => ({
            label: universe.name,
            value: universe.universeUUID
          }))
        ]);
      });
    }
    setAlertUniverseList([
      ...props.universes.data.map((universe) => ({
        label: universe.name,
        value: universe.universeUUID
      }))
    ]);
  }, []);

  /**
   * Constant option for metrics condition.
   */
  const alertMetricsConditionList = metricsData.map((metric, i) => {
    return (
      <option key={i} value={metric.name}>
        {metric.name}
      </option>
    );
  });

  /**
   *
   * @param {Event} Event
   * Disable universe list dropdown and clear all the selection
   */
  const handleTargetTypeChange = (event) => {
    const value = event.target?.value;
    if (value === 'allUniverses') {
      setIsAllUniversesDisabled(true);
      props.updateField('alertConfigForm', 'ALERT_UNIVERSE_LIST', []);
    } else {
      setIsAllUniversesDisabled(false);
    }
  };
  /**
   *
   * @param {Formvalues} values
   * TODO: Make an API call to submit the form by reformatting the payload.
   */
  const handleOnSubmit = (values) => {
    const cUUID = localStorage.getItem('customerId');
    let payload = {
      customerUUID: cUUID,
      name: values['ALERT_CONFIGURATION_NAME'],
      description: values['ALERT_CONFIGURATION_DESCRIPTION'],
      targetType: !enablePlatformAlert ? 'UNIVERSE' : 'CUSTOMER',
      target: !enablePlatformAlert
        ? {
            all: isNonEmptyArray(values['ALERT_UNIVERSE_LIST']) ? false : true,
            uuids: isNonEmptyArray(values['ALERT_UNIVERSE_LIST']) ? [] : null
          }
        : null,
      thresholds: '',
      thresholdUnit: 'MILLISECOND',
      template: 'REPLICATION_LAG',
      durationSec: values['ALERT_METRICS_DURATION'],
      active: true,
      routeUUID: values['ALERT_DESTINATION_LIST'],
      defaultRoute: true
    };

    // Setting up the universe uuids.
    isNonEmptyArray(values['ALERT_UNIVERSE_LIST']) &&
      values['ALERT_UNIVERSE_LIST'].forEach((list) => payload.target.uuids.push(list.value));

    // Setting up the threshold values.
    isNonEmptyArray(values['ALERT_METRICS_CONDITION_POLICY']) &&
      values['ALERT_METRICS_CONDITION_POLICY'].forEach((policy) => {
        payload.thresholds = Object.assign(
          { [policy._SEVERITY]: { condition: policy._CONDITION, threshold: policy._THRESHOLD } },
          payload.thresholds
        );
      });

    createAlertConfig(payload).then(() => onCreateCancel(false));
  };
  return (
    <Formik initialValues={{ ALERT_TARGET_TYPE: 'allUniverses' }}>
      <form name="alertConfigForm" onSubmit={handleSubmit(handleOnSubmit)}>
        <Row className="config-section-header">
          <Row>
            <Col md={6}>
              <div className="form-item-custom-label">Name</div>
              <Field
                name="ALERT_CONFIGURATION_NAME"
                placeHolder="Enter an alert name"
                component={YBTextInputWithLabel}
                validate={required}
                isReadOnly={false}
              />
            </Col>
            <Col md={6}>
              <div className="form-item-custom-label">Description</div>
              <Field
                name="ALERT_CONFIGURATION_DESCRIPTION"
                placeHolder="Enter an alert description"
                component={YBTextArea}
                validate={required}
                isReadOnly={false}
              />
            </Col>
          </Row>
          {!enablePlatformAlert && (
            <Row>
              <Col md={6}>
                <div className="form-item-custom-label">Target</div>
                <YBRadioButtonGroup
                  name="ALERT_TARGET_TYPE"
                  options={[
                    { label: 'All Universes', value: 'allUniverses' },
                    { label: 'Selected Universes', value: 'selectedUniverses' }
                  ]}
                  onClick={handleTargetTypeChange}
                />
                <Field
                  name="ALERT_UNIVERSE_LIST"
                  component={YBMultiSelectWithLabel}
                  options={alertUniverseList}
                  hideSelectedOptions={false}
                  isMulti={true}
                  isDisabled={isAllUniversesDisabled}
                />
              </Col>
            </Row>
          )}
          <hr />
          <Row>
            <Col md={12}>
              <h4>Conditions</h4>
            </Col>
            <Row>
              <Col md={6}>
                <div className="form-item-custom-label">Metrics</div>
                <Field
                  name="ALERT_METRICS_CONDITION"
                  component={YBSelectWithLabel}
                  options={alertMetricsConditionList}
                  // onInputChanged={() => {}}
                />
              </Col>
              <Col md={6}>
                <div className="form-item-custom-label">Duration</div>
                <Field
                  name="ALERT_METRICS_DURATION"
                  component={YBTextInputWithLabel}
                  validate={required}
                  placeHolder="Enter duration in minutes"
                />
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                <div className="form-field-grid">
                  <FieldArray name="ALERT_METRICS_CONDITION_POLICY" component={AlertsPolicy} />
                </div>
              </Col>
            </Row>
          </Row>
          <Row>
            <Col md={6}>
              <div className="form-item-custom-label">Destinations</div>
              <Field
                name="ALERT_DESTINATION_LIST"
                component={YBSelectWithLabel}
                options={alertDestionation}
              />
            </Col>
          </Row>
          <Row className="alert-action-button-container">
            <Col lg={6} lgOffset={6}>
              <YBButton
                btnText="Cancel"
                btnClass="btn"
                onClick={() => {
                  onCreateCancel(false);
                }}
              />
              <YBButton btnText="Save" btnType="submit" btnClass="btn btn-orange" />
            </Col>
          </Row>
        </Row>
      </form>
    </Formik>
  );
};

export default reduxForm({
  form: 'alertConfigForm',
  enableReinitialize: true
})(CreateAlert);
