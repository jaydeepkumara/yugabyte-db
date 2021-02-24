import React from 'react';
import { YBModal } from '../forms/fields';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';
import { Link } from 'react-router';
import './AssociatedUniverse.scss';

function AssociatedUniverse(props) {
  const { onHide, associatedUniverses, visible } = props;

  /**
   * Returns the decorated status.
   * @param universeStatus status of universe.
   */
  const modifyStatus = (universeStatus) => {
    // TODO: Add case for pause status.
    switch (universeStatus) {
      case 'Ready':
        return (
          <div className="universe-status associated-universe-status good">
            <i className="fa fa-check-circle associated-universe-icon" />
            {universeStatus && <span>{universeStatus}</span>}
          </div>
        );
      case 'Error':
        return (
          <div className="universe-status associated-universe-status bad">
            <i className="fa fa-warning associated-universe-icon" />
            {universeStatus && <span>{universeStatus}</span>}
          </div>
        );
    }
  };

  /**
   * Returns the universe name with router link.
   * @param universeName - Name of the universe.
   */
  const getUniverseLink = (universeName, row) => {
    return (
      <div>
        <Link to={`/universes/${row.universeUUID}`}>{universeName}</Link>
      </div>
    );
  };

  return (
    <YBModal
      visible={visible}
      onHide={onHide}
      showCancelButton={true}
      title={'Universes using this certificate'}
    >
      {associatedUniverses.length ? (
        <div>
          <BootstrapTable
            data={associatedUniverses}
            className="backup-list-table middle-aligned-table"
          >
            <TableHeaderColumn dataField="universeUUID" hidden={true} isKey={true}>
              UUID
            </TableHeaderColumn>
            <TableHeaderColumn
              dataField="universeName"
              columnClassName="no-border name-column"
              className="no-border"
              width="80%"
              dataFormat={getUniverseLink}
            >
              Universe Name
            </TableHeaderColumn>
            <TableHeaderColumn
              dataField="universeStatus"
              columnClassName="no-border name-column"
              className="no-border"
              dataFormat={modifyStatus}
            >
              Status
            </TableHeaderColumn>
          </BootstrapTable>
        </div>
      ) : (
        <div>No Associated Universe for Certificate</div>
      )}
    </YBModal>
  );
}

export default AssociatedUniverse;
