import React, { Component } from 'react';
import { Row, Col } from 'react-bootstrap';
import { Field } from 'redux-form';
import { YBFormInput, YBInputField, YBSelect } from '../../common/forms/fields';
import '../CreateAlerts.scss';

export default class AlertsPolicy extends Component {
  /**
   * Constant option for severity types
   * TODO: Source and values of actual list may differ.
   */
  severityTypes = [
    <option key={1} value={'Severe'}>
      {'Severe'}
    </option>,
    <option key={2} value={'High'}>
      {'High'}
    </option>,
    <option key={3} value={'Critical'}>
      {'Critical'}
    </option>
  ];

  /**
   * Constant option for eqality type of policy.
   * TODO: Source and values of actual list may differ.
   */
  conditionTypes = [
    <option key={1} value={'gt'}>
      {'Greater Than'}
    </option>,
    <option key={2} value={'lt'}>
      {'Less than'}
    </option>,
    <option key={3} value={'eq'}>
      {'Equal'}
    </option>
  ];

  /**
   * list of options that frequency unit can take.
   * TODO: Check if seconds are required.
   */
  frequencyUnitOptions = [
    <option key={1} value={'Hours'}>
      {'Hours'}
    </option>,
    <option key={2} value={'Minutes'}>
      {'Minutes'}
    </option>
  ];

  /**
   * Push an enpty object if field array is empty.
   */
  componentDidMount() {
    const { fields } = this.props;
    if (fields.length === 0) {
      this.props.fields.push({});
    }
  }

  /**
   * Add a new row in field array.
   * @param {Event} e 
   */
  addRow = (e) => {
    this.props.fields.push({});
    e.preventDefault();
  };

  /**
   * Remove the element from array based on index.
   * @param {Number} instanceTypeIdx 
   */
  removeRow = (instanceTypeIdx) => {
    this.props.fields.remove(instanceTypeIdx);
  };

  render() {
    const { fields } = this.props;
    return (
      <div className="instance-row-container">
        <Row>
          <Col lg={2} lgOffset={1}>
            Severity
          </Col>
          <Col lg={2}>Condition</Col>
          <Col lg={5}>Utilization Duration</Col>
        </Row>
        {fields.map((instanceTypeItem, instanceTypeIdx) => (
          <Row key={instanceTypeIdx}>
            <Col lg={1}>
              {fields.length > 1 ? (
                <i
                  className="fa fa-minus-circle on-prem-row-delete-btn"
                  onClick={() => this.removeRow(instanceTypeIdx)}
                />
              ) : null}
            </Col>
            <Col lg={2}>
              <Field
                name={`${instanceTypeItem}_SEVERITY`}
                component={YBSelect}
                insetError={true}
                options={this.severityTypes}
              />
            </Col>
            <Col lg={2}>
              <Field
                name={`${instanceTypeItem}_CONDITION`}
                component={YBSelect}
                insetError={true}
                options={this.conditionTypes}
              />
            </Col>
            <Col lg={1}>
              <Field name={`${instanceTypeItem}_THRESHOLD`} component={YBInputField} />
            </Col>
            <Col lg={1}>
              <div className="flex-container">
                <p className="percent-text">%</p>
              </div>
            </Col>
            <Col lg={2}>
              <Field
                name={`${instanceTypeItem}_THRESHOLD_DURATION`}
                component={YBInputField}
                type={'number'}
                placeholder="Interval"
              />
            </Col>
            <Col lg={3}>
              <Field
                name={`${instanceTypeItem}_THRESHOLD_UNIT`}
                component={YBSelect}
                options={this.frequencyUnitOptions}
              />
            </Col>
          </Row>
        ))}
        <Row>
          <Col lg={1}>
            <i className="fa fa-plus-circle fa-2x on-prem-row-add-btn" onClick={this.addRow} />
          </Col>
          <Col lg={3}>
            <a className="on-prem-add-link" onClick={this.addRow}>
              Add Severity{' '}
            </a>
          </Col>
        </Row>
      </div>
    );
  }
}
