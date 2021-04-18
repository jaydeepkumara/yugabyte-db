// Copyright (c) YugaByte, Inc.

import React, { Component } from 'react';
import { Tab, Row, Col } from 'react-bootstrap';
import _ from 'lodash';
import { YBTabsPanel } from '../../panels';
import { YBButton, YBTextInputWithLabel } from '../../common/forms/fields';
import { withRouter } from 'react-router';
import { Field, SubmissionError } from 'redux-form';
import { getPromiseState } from '../../../utils/PromiseUtils';
import { YBLoading } from '../../common/indicators';
import { YBConfirmModal } from '../../modals';
import AwsStorageConfiguration from './AwsStorageConfiguration';
import YBInfoTip from '../../common/descriptors/YBInfoTip';

import awss3Logo from './images/aws-s3.png';
import azureLogo from './images/azure_logo.svg';
import {
  isNonEmptyObject,
  isEmptyObject,
  isDefinedNotNull,
  isNonEmptyArray
} from '../../../utils/ObjectUtils';
import { Formik } from 'formik';

const storageConfigTypes = {
  NFS: {
    title: 'NFS Storage',
    fields: [
      {
        id: 'BACKUP_LOCATION',
        label: 'NFS Storage Path',
        placeHolder: 'NFS Storage Path'
      }
    ]
  },
  GCS: {
    title: 'GCS Storage',
    fields: [
      {
        id: 'BACKUP_LOCATION',
        label: 'GCS Bucket',
        placeHolder: 'GCS Bucket'
      },
      {
        id: 'GCS_CREDENTIALS_JSON',
        label: 'GCS Credentials',
        placeHolder: 'GCS Credentials JSON'
      }
    ]
  },
  AZ: {
    title: 'Azure Storage',
    fields: [
      {
        id: 'BACKUP_LOCATION',
        label: 'Container URL',
        placeHolder: 'Container URL'
      },
      {
        id: 'AZURE_STORAGE_SAS_TOKEN',
        label: 'SAS Token',
        placeHolder: 'SAS Token'
      }
    ]
  }
};

const getTabTitle = (configName) => {
  switch (configName) {
    case 'S3':
      return <img src={awss3Logo} alt="AWS S3" className="aws-logo" />;
    case 'GCS':
      return (
        <h3>
          <i className="fa fa-database"></i>GCS
        </h3>
      );
    case 'AZ':
      return <img src={azureLogo} alt="Azure" className="azure-logo" />;
    default:
      return (
        <h3>
          <i className="fa fa-database"></i>NFS
        </h3>
      );
  }
};

class StorageConfiguration extends Component {
  constructor(props) {
    super(props);

    this.state = {
      enableEditOption: true
    }
  }

  getConfigByType = (name, customerConfigs) => {
    return customerConfigs.data.find((config) => config.name.toLowerCase() === name);
  };

  wrapFields = (configFields, configName, configControls) => {
    const configNameFormatted = configName.toLowerCase();
    return (
      <Tab
        eventKey={configNameFormatted}
        title={getTabTitle(configName)}
        key={configNameFormatted + '-tab'}
        unmountOnExit={true}
      >
        <Row className="config-section-header" key={configNameFormatted}>
          <Col lg={8}>{configFields}</Col>
          {configControls && <Col lg={4}>{configControls}</Col>}
        </Row>
      </Tab>
    );
  };

  addStorageConfig = (values, action, props) => {
    const type =
      (props.activeTab && props.activeTab.toUpperCase()) || Object.keys(storageConfigTypes)[0];
    Object.keys(values).forEach((key) => {
      if (typeof values[key] === 'string' || values[key] instanceof String)
        values[key] = values[key].trim();
    });
    let dataPayload = { ...values };

    // These conditions will pick only the required JSON keys from the respective tab.
    switch (props.activeTab) {
      case 'nfs':
        dataPayload = _.pick(dataPayload, ['BACKUP_LOCATION']);
        break;

      case 'gcs':
        dataPayload = _.pick(dataPayload, ['BACKUP_LOCATION', 'GCS_CREDENTIALS_JSON']);
        break;

      case 'az':
        dataPayload = _.pick(dataPayload, ['BACKUP_LOCATION', 'AZURE_STORAGE_SAS_TOKEN']);
        break;

      default:
        if (values['IAM_INSTANCE_PROFILE']) {
          dataPayload['IAM_INSTANCE_PROFILE'] = dataPayload['IAM_INSTANCE_PROFILE'].toString();
          dataPayload = _.pick(dataPayload, [
            'BACKUP_LOCATION',
            'AWS_HOST_BASE',
            'IAM_INSTANCE_PROFILE'
          ]);
        } else {
           dataPayload = _.pick(dataPayload, [
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'BACKUP_LOCATION',
            'AWS_HOST_BASE'
          ]);
        }
        break;
    }

    if (values.type === "update") {
      this.setState({ enableEditOption: true });
      return this.props
        .updateCustomerConfig({
          type: 'STORAGE',
          configUUID: values.configUUID,
          name: type,
          data: dataPayload
        })
        .then((resp) => {
          if (getPromiseState(this.props.addConfig).isSuccess()) {
            // reset form after successful submission due to BACKUP_LOCATION value is shared across all tabs
            this.props.reset();
            this.props.fetchCustomerConfigs();
          } else if (getPromiseState(this.props.addConfig).isError()) {
            // show server-side validation errors under form inputs
            throw new SubmissionError(this.props.addConfig.error);
          }
        });
    } else {
      this.setState({ enableEditOption: false });
    return this.props
      .addCustomerConfig({
        type: 'STORAGE',
        name: type,
        data: dataPayload
      })
      .then((resp) => {
        if (getPromiseState(this.props.addConfig).isSuccess()) {
          // reset form after successful submission due to BACKUP_LOCATION value is shared across all tabs
          this.props.reset();
          this.props.fetchCustomerConfigs();
        } else if (getPromiseState(this.props.addConfig).isError()) {
          // show server-side validation errors under form inputs
          throw new SubmissionError(this.props.addConfig.error);
        }
      });
    }
  };

  deleteStorageConfig = (configUUID) => {
    this.props.deleteCustomerConfig(configUUID)
      .then(() => {
        this.props.reset(); // reset form to initial values
        this.props.fetchCustomerConfigs();
      });
  };

  showDeleteConfirmModal = (configName) => {
    this.props.showDeleteStorageConfig(configName);
  };

  componentDidMount() {
    this.props.fetchCustomerConfigs();
  }

  /**
   * This method will enable edit options for respective
   * backup config.
   */
  onEditConfig = () => {
    this.setState({ enableEditOption: false });
  }

  /**
   * This method will disable the edit input fields.
   */
  disableEditFields = () => {
    this.setState({ enableEditOption: true });
  }

  /**
   * This method will help to disable the backup storage
   * location field.
   * 
   * @param {string} fieldKey Input Field Id.
   * @returns Boolean.
   */
  disableInputFields = (fieldKey, enableEdit) => {
    return enableEdit || fieldKey === "BACKUP_LOCATION" ? true : false
  };

  /**
   * This method will help us to setup the initial value props
   * to the redux form.
   * 
   * @param {string} activeTab Current Tab.
   * @param {Array<object>} configs Backup config Data.
   */
  setInitialConfiValues = (activeTab = "nfs", configs) => {
    const data = !isNonEmptyArray(configs) &&
      configs.data.filter((config) => config.name === activeTab.toUpperCase());
    const initialVal = data.map((obj) => {
      switch (activeTab) {
        case "nfs":
          return {
            type: "update",
            configUUID: obj?.configUUID,
            BACKUP_LOCATION: obj.data?.BACKUP_LOCATION
          };

        case "gcs":
          return {
            type: "update",
            configUUID: obj?.configUUID,
            BACKUP_LOCATION: obj.data?.BACKUP_LOCATION,
            GCS_CREDENTIALS_JSON: obj.data?.GCS_CREDENTIALS_JSON
          };

        case "az":
          return {
            type: "update",
            configUUID: obj?.configUUID,
            BACKUP_LOCATION: obj.data?.BACKUP_LOCATION,
            AZURE_STORAGE_SAS_TOKEN: obj.data?.AZURE_STORAGE_SAS_TOKEN
          };

        default:
          if (isDefinedNotNull(obj.data?.IAM_INSTANCE_PROFILE)) {
            return {
              type: "update",
              configUUID: obj?.configUUID,
              IAM_INSTANCE_PROFILE: obj.data?.IAM_INSTANCE_PROFILE,
              BACKUP_LOCATION: obj.data?.BACKUP_LOCATION,
              AWS_HOST_BASE: obj.data?.AWS_HOST_BASE
            }
          } else {
            return {
              type: "update",
              configUUID: obj?.configUUID,
              AWS_ACCESS_KEY_ID: obj.data?.AWS_ACCESS_KEY_ID,
              AWS_SECRET_ACCESS_KEY: obj.data?.AWS_SECRET_ACCESS_KEY,
              BACKUP_LOCATION: obj.data?.BACKUP_LOCATION,
              AWS_HOST_BASE: obj.data?.AWS_HOST_BASE
            }
          }
      }
    });

    this.props.setInitialConfigValues(initialVal[0]);
  };

  render() {
    const {
      handleSubmit,
      submitting,
      addConfig: { loading },
      customerConfigs,
      initialValues
    } = this.props;
    const { enableEditOption } = this.state;
    const activeTab = this.props.activeTab || Object.keys(storageConfigTypes)[0].toLowerCase();
    const config = this.getConfigByType(activeTab, customerConfigs);

    if (getPromiseState(customerConfigs).isLoading()) {
      return <YBLoading />;
    }

    if (
      getPromiseState(customerConfigs).isSuccess() ||
      getPromiseState(customerConfigs).isEmpty()
    ) {
      const configs = [
        <Tab
          eventKey={'s3'}
          title={getTabTitle('S3')}
          key={'s3-tab'}
          unmountOnExit={true}
          onSelect={this.setInitialConfiValues(this.props.activeTab, customerConfigs)}>
          <AwsStorageConfiguration
            {...this.props}
            deleteStorageConfig={this.deleteStorageConfig}
            enableEdit={enableEditOption}
            onEditConfig={this.onEditConfig}
          />
        </Tab>
      ];
      Object.keys(storageConfigTypes).forEach((configName) => {
        const config = customerConfigs.data.find((config) => config.name === configName);
        if (isDefinedNotNull(config)) {
          const configData = [];
          const storageConfig = storageConfigTypes[config.name];
          if (!isDefinedNotNull(storageConfig)) {
            return;
          }
          const fieldAttrs = storageConfigTypes[config.name]['fields'];
          for (const configItem in config.data) {
            const configAttr = fieldAttrs.find((item) => item.id === configItem);
            if (isDefinedNotNull(configAttr)) {
              configData.push({ name: configAttr.label, data: config.data[configItem] });
            }
          }

          const configFields = [];
          const configTemplate = storageConfigTypes[configName];
          configTemplate.fields.forEach((field) => {
            configFields.push(
              <Row className="config-provider-row" key={configName + field.id}>
                <Col lg={2}>
                  <div className="form-item-custom-label">{field.label}</div>
                </Col>
                <Col lg={10}>
                  <Field
                    name={field.id}
                    placeHolder={field.placeHolder}
                    component={YBTextInputWithLabel}
                    isReadOnly={this.disableInputFields(field.id, enableEditOption)}
                  />
                </Col>
              </Row>
            );
          });

          const configControls = (
            <div className="action-bar">
              {config.inUse && (
                <YBInfoTip content={"Storage configuration is in use and cannot be deleted until associated resources are removed."}
                  placement="top"
                >
                  <span className="disable-delete fa-stack fa-2x">
                    <i className="fa fa-trash-o fa-stack-1x"></i>
                    <i className="fa fa-ban fa-stack-2x"></i>
                  </span>
                </YBInfoTip>
              )}
              <YBButton
                btnText={'Delete Configuration'}
                disabled={config.inUse || submitting || loading || isEmptyObject(config)}
                btnClass={'btn btn-default'}
                onClick={
                  isDefinedNotNull(config)
                    ? this.showDeleteConfirmModal.bind(this, config.name)
                    : () => {}
                }
              />
              {activeTab !== "nfs" &&
                <YBButton
                  btnText='Edit Configuration'
                  btnClass='btn btn-orange'
                  onClick={this.onEditConfig}
                />
              }
              {isDefinedNotNull(config) && (
                <YBConfirmModal
                  name="delete-storage-config"
                  title={'Confirm Delete'}
                  onConfirm={handleSubmit(this.deleteStorageConfig.bind(this, config.configUUID))}
                  currentModal={'delete' + config.name + 'StorageConfig'}
                  visibleModal={this.props.visibleModal}
                  hideConfirmModal={this.props.hideDeleteStorageConfig}
                >
                  Are you sure you want to delete {config.name} Storage Configuration?
                </YBConfirmModal>
              )}
            </div>
          );

          configs.push(this.wrapFields(configFields, configName, configControls));
        } else {
          const configFields = [];
          const config = storageConfigTypes[configName];
          config.fields.forEach((field) => {
            configFields.push(
              <Row className="config-provider-row" key={configName + field.id}>
                <Col lg={2}>
                  <div className="form-item-custom-label">{field.label}</div>
                </Col>
                <Col lg={10}>
                  <Field
                    name={field.id}
                    placeHolder={field.placeHolder}
                    component={YBTextInputWithLabel}
                  />
                </Col>
              </Row>
            );
          });
          configs.push(this.wrapFields(configFields, configName));
        }
      });

      return (
        <div className="provider-config-container">
          <Formik initialValues={initialValues}>
            <form name="storageConfigForm" onSubmit={handleSubmit(this.addStorageConfig)}>
              <YBTabsPanel
                defaultTab={Object.keys(storageConfigTypes)[0].toLowerCase()}
                activeTab={activeTab}
                id="storage-config-tab-panel"
                className="config-tabs"
                routePrefix="/config/backup/"
              >
                {configs}
              </YBTabsPanel>

              <div className="form-action-button-container">
                {!isNonEmptyObject(config) ?
                  <YBButton
                    btnText={'Save'}
                    btnClass={'btn btn-orange'}
                    disabled={submitting || loading}
                    btnType="submit"
                  /> :
                  <>
                    {!enableEditOption &&
                      <YBButton
                        btnText='Update'
                        btnClass={'btn btn-orange'}
                        btnType="submit"
                      />
                    }
                    {!enableEditOption &&
                      <YBButton
                        btnText='Cancel'
                        btnClass={'btn btn-default'}
                        btnType="cancel"
                        onClick={this.disableEditFields}
                      />
                    }
                  </>
                }
              </div>
            </form>
          </Formik>
        </div>
      );
    }
    return <YBLoading />;
  }
}

export default withRouter(StorageConfiguration);
