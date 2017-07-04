import * as React from "react";
import {connect, Dispatch} from "react-redux";
import {State, DataStoreState, DataSourceState} from "../state";
import {AnchorButton, InputGroup, Classes, Tag, Tabs2, Tab2, Tooltip, Checkbox, Colors} from "@blueprintjs/core";
import {Table, Column, Cell, TruncatedFormat} from "@blueprintjs/table";
import {ListBox, ListBoxSelectionMode} from "../components/ListBox";
import {Card} from "../components/Card";
import {ScrollablePanelContent} from "../components/ScrollableContent";
import {ContentWithDetailsPanel} from "../components/ContentWithDetailsPanel";
import DownloadDatasetDialog from "./DownloadDataSourceDialog";
import OpenDatasetDialog from "./OpenDatasetDialog";
import AddDatasetDialog from "./AddDatasetDialog";
import RemoveDatasetDialog from "./RemoveDatasetDialog";
import * as actions from "../actions";
import * as selectors from "../selectors";
import {NO_DATA_STORES_FOUND, NO_DATA_SOURCES_FOUND, NO_LOCAL_DATA_SOURCES} from "../messages";


interface IDataSourcesPanelProps {
    hasWorkspace: boolean;
    dataStores: Array<DataStoreState>;
    dataSourceFilterExpr: string;
    selectedDataStore: DataStoreState | null;
    selectedDataSource: DataSourceState | null;
    selectedDataSources: DataSourceState[] | null;
    filteredDataSources: DataSourceState[] | null;
    showDataSourceDetails: boolean;
    showHumanReadableDataSourceTitles: boolean;
}

function mapStateToProps(state: State): IDataSourcesPanelProps {
    return {
        hasWorkspace: !!selectors.workspaceSelector(state),
        dataStores: selectors.dataStoresSelector(state),
        dataSourceFilterExpr: selectors.dataSourceFilterExprSelector(state),
        selectedDataStore: selectors.selectedDataStoreSelector(state),
        selectedDataSource: selectors.selectedDataSourceSelector(state),
        selectedDataSources: selectors.selectedDataSourcesSelector(state),
        filteredDataSources: selectors.filteredDataSourcesSelector(state),
        showDataSourceDetails: selectors.showDataSourceDetailsSelector(state),
        showHumanReadableDataSourceTitles: selectors.showHumanReadableDataSourceTitlesSelector(state),
    };
}

interface IDataSourcesPanelDispatch {
    setSelectedDataStoreId(selectedDataStoreId: string): void;
    setSelectedDataSourceId(selectedDataSourceId: string): void;
    setDataSourceFilterExpr(dataSourceFilterExpr: string): void;
    setControlState(propertyName: string, value: any): void;
    updateSessionState(sessionState: any): void;
    loadTemporalCoverage(dataStoreId: string, dataSourceId: string): void;
    showDialog(dialogId: string): void;
    hideDialog(dialogId: string): void;
}

const mapDispatchToProps = {
    setSelectedDataStoreId: actions.setSelectedDataStoreId,
    setSelectedDataSourceId: actions.setSelectedDataSourceId,
    setDataSourceFilterExpr: actions.setDataSourceFilterExpr,
    setControlState: actions.setControlProperty,
    updateSessionState: actions.updateSessionState,
    loadTemporalCoverage: actions.loadTemporalCoverage,
    showDialog: actions.showDialog,
    hideDialog: actions.hideDialog,
};

/**
 * The DataSourcesPanel is used browse and open data data sources originating from a selected data store.
 *
 * @author Norman Fomferra
 */
class DataSourcesPanel extends React.Component<IDataSourcesPanelProps & IDataSourcesPanelDispatch, null> {

    private static readonly FLEX_ROW_STYLE = {display: "flex", alignItems: "center"};
    private static readonly SPACER_STYLE = {flex: 1};

    constructor(props: IDataSourcesPanelProps) {
        super(props);
        this.handleAddDatasetDialog = this.handleAddDatasetDialog.bind(this);
        this.handleRemoveDatasetDialog = this.handleRemoveDatasetDialog.bind(this);
        this.handleShowDownloadDataSourceDialog = this.handleShowDownloadDataSourceDialog.bind(this);
        this.handleShowOpenDatasetDialog = this.handleShowOpenDatasetDialog.bind(this);
        this.handleShowDetailsChanged = this.handleShowDetailsChanged.bind(this);
        this.handleDataStoreSelected = this.handleDataStoreSelected.bind(this);
        this.onShowHumanReadableTitleChange = this.onShowHumanReadableTitleChange.bind(this);
    }

    private handleAddDatasetDialog() {
        this.props.showDialog('addDatasetDialog');
    }

    private handleRemoveDatasetDialog() {
        this.props.showDialog('removeDatasetDialog');
    }

    private handleShowDownloadDataSourceDialog() {
        this.maybeLoadTemporalCoverage();
        this.props.showDialog('downloadDataSourceDialog');
    }

    private handleShowOpenDatasetDialog() {
        this.maybeLoadTemporalCoverage();
        this.props.showDialog('openDatasetDialog');
    }

    private maybeLoadTemporalCoverage() {
        if (!this.props.selectedDataSource.temporalCoverage) {
            this.props.loadTemporalCoverage(this.props.selectedDataStore.id, this.props.selectedDataSource.id);
        }
    }

    private handleDataStoreSelected(event) {
        const dataStoreId = event.target.value;
        this.props.setSelectedDataStoreId(dataStoreId);
    }

    private handleShowDetailsChanged(value: boolean) {
        this.props.setControlState('showDataSourceDetails', value);
    }

    private onShowHumanReadableTitleChange(ev: any) {
        this.props.updateSessionState({showHumanReadableDataSourceTitles: ev.target.checked});
    }

    render() {
        const hasDataStores = this.props.dataStores && this.props.dataStores.length;
        const hasDataSources = this.props.selectedDataSources && this.props.selectedDataSources.length;
        let body;
        if (hasDataStores) {
            const hasSelection = this.props.selectedDataSource;
            const isLocalStore = this.props.selectedDataStore && this.props.selectedDataStore.id === 'local';
            const isNonLocalStore = this.props.selectedDataStore && this.props.selectedDataStore.id !== 'local';
            const canAdd = isLocalStore;
            const canRemove = hasSelection && isLocalStore;
            const canDownload = hasSelection && !isLocalStore;
            const canOpen = hasSelection && this.props.hasWorkspace;
            let primaryAction;
            if (isLocalStore) {
                primaryAction = (
                    <Tooltip content="Open local dataset">
                        <AnchorButton className={"pt-intent-primary"}
                                      onClick={this.handleShowOpenDatasetDialog}
                                      disabled={!canOpen}
                                      iconName="folder-shared-open"/>
                    </Tooltip>
                );
            } else {
                primaryAction = (
                    <Tooltip content="Download and/or open remote dataset">
                        <AnchorButton className={"pt-intent-primary"}
                                      onClick={this.handleShowDownloadDataSourceDialog}
                                      disabled={!canDownload}
                                      iconName="cloud-download"/>
                    </Tooltip>
                );
            }
            const actionComponent = (
                <div className="pt-button-group">
                    <Tooltip content="Add local data source">
                        <AnchorButton className={(isLocalStore && !hasDataSources) ? "pt-intent-primary" : ""}
                                      onClick={this.handleAddDatasetDialog}
                                      disabled={!canAdd}
                                      iconName="add"/>
                    </Tooltip>
                    <Tooltip content="Remove local data source">
                        <AnchorButton
                            onClick={this.handleRemoveDatasetDialog}
                            disabled={!canRemove}
                            iconName="trash"/>
                    </Tooltip>
                    {primaryAction}
                    <AddDatasetDialog/>
                    <RemoveDatasetDialog/>
                    <DownloadDatasetDialog/>
                    <OpenDatasetDialog/>
                </div>
            );
            body = (
                <div>
                    {this.renderDataStoreSelector()}
                    {this.renderDataSourceFilterExprInput()}
                    <ContentWithDetailsPanel showDetails={this.props.showDataSourceDetails}
                                             onShowDetailsChange={this.handleShowDetailsChanged}
                                             isSplitPanel={true}
                                             initialContentHeight={200}
                                             actionComponent={actionComponent}>
                        <DataSourcesList dataSources={this.props.filteredDataSources}
                                         selectedDataSourceId={this.props.selectedDataSource ? this.props.selectedDataSource.id : null}
                                         setSelectedDataSourceId={this.props.setSelectedDataSourceId}
                                         showHumanReadableDataSourceTitles={this.props.showHumanReadableDataSourceTitles}
                                         doubleClickAction={isLocalStore ? this.handleShowOpenDatasetDialog : isNonLocalStore ? this.handleShowDownloadDataSourceDialog : null}/>
                        <DataSourceDetails dataSource={this.props.selectedDataSource}/>
                    </ContentWithDetailsPanel>
                </div>
            );
        } else if (hasDataStores) {
            body = <div>
                {this.renderDataStoreSelector()}
                {this.renderNoDataSourcesMessage()}
            </div>;
        } else {
            body = this.renderNoDataStoreMessage();
        }
        return body;
    }

    private renderDataSourceFilterExprInput() {
        const resultsTag = (
            <Tag className={Classes.MINIMAL} onRemove={(event) => this.props.setDataSourceFilterExpr("")}>
                {this.props.filteredDataSources && this.props.filteredDataSources.length}
            </Tag>
        );

        return (<div style={{paddingTop: 4, paddingBottom: 2}}>
            <InputGroup
                disabled={false}
                leftIconName="filter"
                onChange={(event) => this.props.setDataSourceFilterExpr(event.target.value)}
                placeholder="Find data source"
                rightElement={resultsTag}
                value={this.props.dataSourceFilterExpr}
            />
        </div>);
    }

    private renderDataStoreSelector() {
        if (!this.props.dataStores || !this.props.dataStores.length) {
            return null;
        }

        const dataStoreOptions = [];
        for (let dataStore of this.props.dataStores) {
            dataStoreOptions.push(<option key={dataStore.id} value={dataStore.id}>{dataStore.name}</option>);
        }

        const selectedDataStore = this.props.selectedDataStore;
        const showHumanReadableDataSourceTitles = this.props.showHumanReadableDataSourceTitles;
        //  a label has by default a 15px margin at the bottom
        return (
            <div style={DataSourcesPanel.FLEX_ROW_STYLE}>
                <label className="pt-label pt-inline" style={{margin: "0 0 0 0"}}>
                    Data store:
                    <div className="pt-select" style={{padding: '0.2em'}}>
                        <select value={selectedDataStore ? selectedDataStore.id : ''}
                                onChange={this.handleDataStoreSelected}>
                            {dataStoreOptions}
                        </select>
                    </div>
                </label>
                <span style={DataSourcesPanel.SPACER_STYLE}/>
                <Checkbox style={{marginTop: '1em'}}
                          label="Human readable titles"
                          checked={showHumanReadableDataSourceTitles}
                          onChange={this.onShowHumanReadableTitleChange}
                />
            </div>
        );
    }

    //noinspection JSMethodCanBeStatic
    private renderNoDataStoreMessage() {
        return NO_DATA_STORES_FOUND;
    }

    //noinspection JSMethodCanBeStatic
    private renderNoDataSourcesMessage() {
        const selectedDataStore = this.props.selectedDataStore;
        if (selectedDataStore && selectedDataStore.id === 'local') {
            return NO_LOCAL_DATA_SOURCES;
        } else {
            return NO_DATA_SOURCES_FOUND;
        }
    }
}

interface IDataSourcesListProps {
    dataSources: DataSourceState[];
    selectedDataSourceId: string | null;
    setSelectedDataSourceId: (selectedDataSourceId: string) => void;
    showHumanReadableDataSourceTitles: boolean;
    doubleClickAction: (dataSource: DataSourceState) => any;
}
class DataSourcesList extends React.PureComponent<IDataSourcesListProps, null> {

    readonly defaultIconName = 'cci';

    constructor(props: IDataSourcesListProps) {
        super(props);
        this.renderIcon = this.renderIcon.bind(this);
        this.renderDsTitleHumanReadable = this.renderDsTitleHumanReadable.bind(this);
        this.renderDsTitle = this.renderDsTitle.bind(this);
        this.handleDataSourceSelected = this.handleDataSourceSelected.bind(this);
        this.handleIconLoadError = this.handleIconLoadError.bind(this);
    }

    private handleDataSourceSelected(newSelection: Array<React.Key>) {
        if (newSelection.length > 0) {
            this.props.setSelectedDataSourceId(newSelection[0] as string);
        } else {
            this.props.setSelectedDataSourceId(null);
        }
    }

    private handleIconLoadError(img) {
        img.onError = null;
        img.src = `resources/images/data-sources/esacci/${this.defaultIconName}.png`;
    }

    private static getItemKey(dataSource: DataSourceState) {
        return dataSource.id;
    }

    private renderIcon(dataSource: DataSourceState) {
        // TODO (forman): compute icon size based on screen resolution
        const imageSize = 32;
        const iconName = ((dataSource.meta_info && dataSource.meta_info.cci_project) || 'cci').toLowerCase();
        return <img src={`resources/images/data-sources/esacci/${iconName}.png`}
                    style={{width: imageSize, height: imageSize, flex: 'none', marginRight: 6}}
                    onError={this.handleIconLoadError}/>
    }

    private renderDsTitleHumanReadable(dataSource: DataSourceState) {
        const title = (dataSource.meta_info && dataSource.meta_info.title);
        const name = dataSource.name.replace('esacci', '').replace(/\./g, ' ');
        return (
            <div style={{display: 'flex', alignItems: 'center'}}>
                {this.renderIcon(dataSource)}
                <div>
                    <div>{title}</div>
                    <div style={{color: Colors.BLUE5}}>{name}</div>
                </div>
            </div>
        );
    }

    private renderDsTitle(dataSource: DataSourceState) {
        const name = dataSource.name.replace('esacci', '').replace(/\./g, ' ');
        return (
            <div style={{display: 'flex', alignItems: 'center'}}>
                {this.renderIcon(dataSource)}
                <span>{name}</span>
            </div>
        );
    }

    render() {
        let renderTitle;
        if (this.props.showHumanReadableDataSourceTitles) {
            renderTitle = this.renderDsTitleHumanReadable
        } else {
            renderTitle = this.renderDsTitle
        }

        return (
            <ScrollablePanelContent>
                <ListBox items={this.props.dataSources}
                         getItemKey={DataSourcesList.getItemKey}
                         renderItem={renderTitle}
                         selectionMode={ListBoxSelectionMode.SINGLE}
                         selection={this.props.selectedDataSourceId}
                         onItemDoubleClick={this.props.doubleClickAction}
                         onSelection={this.handleDataSourceSelected}/>
            </ScrollablePanelContent>
        );
    }
}
interface DetailPart {
    title: string;
    id: string;
    element: JSX.Element;
}

interface IDataSourceDetailsProps {
    dataSource: DataSourceState
    dispatch?: Dispatch<State>;
}
class _DataSourceDetails extends React.PureComponent<IDataSourceDetailsProps, null> {

    constructor(props: IDataSourceDetailsProps) {
        super(props);
        this.renderAbstract = this.renderAbstract.bind(this);
        this.openOdpLink = this.openOdpLink.bind(this);
    }

    private openOdpLink() {
        const uuid = this.props.dataSource.meta_info.uuid;
        const url = "http://catalogue.ceda.ac.uk/uuid/" + uuid;
        actions.openUrlInBrowser(url);
    }

    private renderAbstract(meta_info: any): DetailPart {
        // currently not shown
        // let spatialCoverage;
        // if (meta_info.bbox_miny && meta_info.bbox_maxy && meta_info.bbox_minx && meta_info.bbox_maxx) {
        //     spatialCoverage = (<div><h5>Spatial coverage</h5>
        //         <table>
        //             <tbody>
        //             <tr>
        //                 <td/>
        //                 <td>{meta_info.bbox_maxy}&#176;</td>
        //                 <td/>
        //             </tr>
        //             <tr>
        //                 <td>{meta_info.bbox_minx}&#176;</td>
        //                 <td/>
        //                 <td>{meta_info.bbox_maxx}&#176;</td>
        //             </tr>
        //             <tr>
        //                 <td/>
        //                 <td>{meta_info.bbox_miny}&#176;</td>
        //                 <td/>
        //             </tr>
        //             </tbody>
        //         </table>
        //     </div>)
        // }
        let openOdpPage;
        if (meta_info.uuid) {
            openOdpPage =
                <AnchorButton onClick={this.openOdpLink} style={{float: 'right', margin: 4}}>Catalogue</AnchorButton>
        }
        return {
            title: "Abstract",
            id: "abstract",
            element: (
                <ScrollablePanelContent>
                    <Card>
                        {openOdpPage}
                        {meta_info.abstract}
                    </Card>
                </ScrollablePanelContent>
            )
        };
    }

    private static renderVariablesTable(variables: any[]): DetailPart {
        function renderName(rowIndex: number) {
            const variable = variables[rowIndex];
            return <Cell><TruncatedFormat>{variable.name}</TruncatedFormat></Cell>;
        }

        function renderUnit(rowIndex: number) {
            const variable = variables[rowIndex];
            return <Cell><TruncatedFormat>{variable.units || '-'}</TruncatedFormat></Cell>;
        }

        function getCellClipboardData(row: number, col: number) {
            console.log('getCellClipboardData: ', row, col);
        }

        return {
            title: "Variables",
            id: "var",
            element: (
                <Table numRows={variables.length}
                       isRowHeaderShown={false}
                       getCellClipboardData={getCellClipboardData}>
                    <Column name="Name" renderCell={renderName}/>
                    <Column name="Units" renderCell={renderUnit}/>
                </Table>
            )
        };
    }

    private static renderMetaInfoTable(metaInfoKeys: string[], meta_info: any): DetailPart {
        function renderKey(rowIndex: number) {
            const key = metaInfoKeys[rowIndex];
            return <Cell><TruncatedFormat>{key}</TruncatedFormat></Cell>;
        }

        function renderValue(rowIndex: number) {
            const key = metaInfoKeys[rowIndex];
            return <Cell><TruncatedFormat>{meta_info[key]}</TruncatedFormat></Cell>;
        }

        function getCellClipboardData(row: number, col: number) {
            console.log('getCellClipboardData: ', row, col);
        }

        return {
            title: "Meta-Info",
            id: "meta",
            element: (
                <Table numRows={metaInfoKeys.length}
                       isRowHeaderShown={false}
                       getCellClipboardData={getCellClipboardData}>
                    <Column name="Key" renderCell={renderKey}/>
                    <Column name="Value" renderCell={renderValue}/>
                </Table>
            )
        };
    }

    render() {
        const dataSource = this.props.dataSource;
        if (!dataSource) {
            return null;
        }
        const details: DetailPart[] = [];
        if (dataSource.meta_info) {
            if (dataSource.meta_info.abstract) {
                details.push(this.renderAbstract(dataSource.meta_info));
            }
            const metaInfoKeys = Object.keys(dataSource.meta_info).filter(key => key !== 'variables');
            if (dataSource.meta_info.variables) {
                const variables = dataSource.meta_info.variables;
                if (variables.length) {
                    details.push(_DataSourceDetails.renderVariablesTable(variables));
                }
            }
            if (metaInfoKeys.length) {
                details.push(_DataSourceDetails.renderMetaInfoTable(metaInfoKeys, dataSource.meta_info));
            }
        }

        if (details.length == 1) {
            return details[0].element;
        } else if (details.length > 1) {
            return (
                <Tabs2 id="dsDetails" renderActiveTabPanelOnly={true}>
                    {details.map(d => <Tab2 key={d.id} id={d.id} title={d.title} panel={d.element}/>)}
                </Tabs2>
            );
        } else {
            return (
                <Card>
                    <p>No meta-information available.</p>
                </Card>
            );
        }

    }
}
const DataSourceDetails = connect()(_DataSourceDetails);

export default connect(mapStateToProps, mapDispatchToProps)(DataSourcesPanel);
