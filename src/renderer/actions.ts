import {
    WorkspaceState, DataStoreState, TaskState, State, ResourceState, VariableImageLayerState,
    LayerState, ColorMapCategoryState, ImageLayerState, ImageStatisticsState, VariableState
} from "./state";
import {DatasetAPI} from "./webapi/apis/DatasetAPI";
import {JobProgress, JobFailure, JobStatusEnum} from "./webapi/Job";
import {WorkspaceAPI} from "./webapi/apis/WorkspaceAPI";
import {ColorMapsAPI} from "./webapi/apis/ColorMapsAPI";

// TODO write tests for actions


const CANCELLED_CODE = 999;

function assert(condition: any, message: string) {
    if (!condition) {
        throw new Error(`assertion failed: ${message}`);
    }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Application-level actions

export const APPLY_INITIAL_STATE = 'APPLY_INITIAL_STATE';
export const SET_WEBAPI_STATUS = 'SET_WEBAPI_STATUS';
export const SET_DIALOG_STATE = 'SET_DIALOG_STATE';
export const SET_TASK_STATE = 'SET_TASK_STATE';
export const SET_CONTROL_STATE = 'SET_CONTROL_STATE';

export function applyInitialState(initialState: Object) {
    return {type: APPLY_INITIAL_STATE, payload: initialState};
}

export function setWebAPIStatus(webAPIClient, webAPIStatus: 'connecting'|'open'|'error'|'closed') {
    return {type: SET_WEBAPI_STATUS, payload: {webAPIClient, webAPIStatus}};
}

export function setDialogState(dialogId: string, dialogState: any) {
    return {type: SET_DIALOG_STATE, payload: {dialogId, dialogState}};
}

export function setTaskState(jobId: number, taskState: TaskState) {
    return {type: SET_TASK_STATE, payload: {jobId, taskState}};
}

export function setControlState(propertyName: string, value: any) {
    const payload = {};
    payload[propertyName] = value;
    return {type: SET_CONTROL_STATE, payload};
}

export function cancelJob(jobId: number) {
    return (dispatch, getState) => {
        const state: State = getState();
        // TODO jobSubmitted, jobDone ???
        state.data.appConfig.webAPIClient.cancel(jobId);
    }
}

function jobSubmitted(jobId: number, title: string) {
    return setTaskState(jobId, {status: JobStatusEnum.SUBMITTED, title: title});
}

function jobProgress(progress: JobProgress) {
    return setTaskState(progress.id, {status: JobStatusEnum.IN_PROGRESS, progress});
}

function jobDone(jobId: number) {
    return setTaskState(jobId, {status: JobStatusEnum.DONE});
}

function jobFailed(jobId: number, failure: JobFailure) {
    console.error(failure);
    return setTaskState(jobId, {
        status: failure.code === CANCELLED_CODE ? JobStatusEnum.CANCELLED : JobStatusEnum.FAILED,
        failure
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Data stores / data sources actions

export const UPDATE_DATA_STORES = 'UPDATE_DATA_STORES';
export const UPDATE_DATA_SOURCES = 'UPDATE_DATA_SOURCES';
export const SET_SELECTED_DATA_STORE_ID = 'SET_SELECTED_DATA_STORE_ID';
export const SET_SELECTED_DATA_SOURCE_ID = 'SET_SELECTED_DATA_SOURCE_ID';
export const SET_DATA_SOURCE_FILTER_EXPR = 'SET_DATA_SOURCE_FILTER_EXPR';

/**
 * Asynchronously load the available Cate data stores.
 * Called only a single time on app initialisation.
 *
 * @returns {(dispatch:any, getState:any)=>undefined}
 */
export function loadDataStores() {
    return (dispatch, getState) => {
        const jobPromise = datasetAPI(getState()).getDataStores();
        dispatch(jobSubmitted(jobPromise.getJobId(), "Loading Data Stores"));
        jobPromise.then((dataStores: Array<DataStoreState>) => {
            dispatch(updateDataStores(dataStores));
            dispatch(jobDone(jobPromise.getJobId()));
            if (dataStores && dataStores.length) {
                dispatch(setSelectedDataStoreId(dataStores[0].id));
            } else {
                dispatch(setSelectedDataStoreId(null));
            }
        }).catch(failure => {
            dispatch(jobFailed(jobPromise.getJobId(), failure));
        });
    }
}

function updateDataStores(dataStores: Array<DataStoreState>) {
    return {type: UPDATE_DATA_STORES, payload: {dataStores}};
}

/**
 * Asynchronously load data sources for given data store ID.
 *
 * @param dataStoreId
 * @returns {(dispatch:any, getState:any)=>undefined}
 */
export function loadDataSources(dataStoreId: string) {
    return (dispatch, getState) => {
        const dataStore = getState().data.dataStores.find(dataStore => dataStore.id === dataStoreId);
        const jobPromise = datasetAPI(getState()).getDataSources(dataStoreId, (progress: JobProgress) => {
            dispatch(jobProgress(progress));
        });
        dispatch(jobSubmitted(jobPromise.getJobId(), "Loading Data Sources: " + dataStore.name));
        jobPromise.then(dataSources => {
            dispatch(updateDataSources(dataStoreId, dataSources));
            dispatch(jobDone(jobPromise.getJobId()));
            if (dataSources && dataSources.length) {
                dispatch(setSelectedDataSourceId(dataSources[0].id));
            } else {
                dispatch(setSelectedDataSourceId(null));
            }
        }).catch(failure => {
            dispatch(jobFailed(jobPromise.getJobId(), failure));
        });
    }
}

function updateDataSources(dataStoreId: string, dataSources) {
    return {type: UPDATE_DATA_SOURCES, payload: {dataStoreId, dataSources}};
}

export function setSelectedDataStoreId(selectedDataStoreId: string|null) {
    return (dispatch, getState) => {
        if (getState().control.selectedDataStoreId === selectedDataStoreId) {
            return;
        }
        dispatch({type: SET_SELECTED_DATA_STORE_ID, payload: {selectedDataStoreId: selectedDataStoreId}});
        if (selectedDataStoreId !== null) {
            const dataStore = getState().data.dataStores.find(dataStore => dataStore.id === selectedDataStoreId);
            if (!dataStore.dataSources) {
                dispatch(loadDataSources(selectedDataStoreId));
            }
        }
    }
}

export function setSelectedDataSourceId(selectedDataSourceId: string|null) {
    return {type: SET_SELECTED_DATA_SOURCE_ID, payload: {selectedDataSourceId}};
}

export function setDataSourceFilterExpr(dataSourceFilterExpr: string) {
    return {type: SET_DATA_SOURCE_FILTER_EXPR, payload: {dataSourceFilterExpr}};
}

function datasetAPI(state: State) {
    return new DatasetAPI(state.data.appConfig.webAPIClient);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Operation actions

export const UPDATE_OPERATIONS = 'UPDATE_OPERATIONS';
export const SET_SELECTED_OPERATION_NAME = 'SET_SELECTED_OPERATION_NAME';
export const SET_OPERATION_FILTER_TAGS = 'SET_OPERATION_FILTER_TAGS';
export const SET_OPERATION_FILTER_EXPR = 'SET_OPERATION_FILTER_EXPR';

export function updateOperations(operations) {
    return {type: UPDATE_OPERATIONS, payload: {operations}};
}

export function setSelectedOperationName(selectedOperationName: string|null) {
    return {type: SET_SELECTED_OPERATION_NAME, payload: {selectedOperationName}};
}

export function setOperationFilterTags(operationFilterTags: Array<string>) {
    return {type: SET_OPERATION_FILTER_TAGS, payload: {operationFilterTags}};
}

export function setOperationFilterExpr(operationFilterExpr: Array<string>) {
    return {type: SET_OPERATION_FILTER_EXPR, payload: {operationFilterExpr}};
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Workspace actions

export const SET_CURRENT_WORKSPACE = 'SET_CURRENT_WORKSPACE';
export const SET_SELECTED_WORKSPACE_RESOURCE_ID = 'SET_SELECTED_WORKSPACE_RESOURCE_ID';
export const SET_SELECTED_WORKFLOW_STEP_ID = 'SET_SELECTED_WORKFLOW_STEP_ID';

/**
 * Asynchronously load the initial workspace.
 * Called only a single time on app initialisation.
 *
 * @returns {(dispatch:any, getState:any)=>undefined}
 */
export function loadInitialWorkspace() {
    return (dispatch, getState) => {
        const openLastWorkspace = getState().session.openLastWorkspace;
        const lastWorkspacePath = getState().session.lastWorkspacePath;

        let jobPromise;
        if (openLastWorkspace && lastWorkspacePath) {
            jobPromise = workspaceAPI(getState()).openWorkspace(lastWorkspacePath);
        } else {
            jobPromise = workspaceAPI(getState()).newWorkspace();
        }
        dispatch(jobSubmitted(jobPromise.getJobId(), "Loading Workspace"));
        jobPromise.then((workspace: WorkspaceState) => {
            dispatch(setCurrentWorkspace(workspace));
            dispatch(jobDone(jobPromise.getJobId()));
            if (workspace && workspace.workflow.steps.length > 0) {
                dispatch(setSelectedWorkspaceResourceId(workspace.workflow.steps[0].id));
            } else {
                dispatch(setSelectedWorkspaceResourceId(null));
            }
        }).catch(failure => {
            dispatch(jobFailed(jobPromise.getJobId(), failure));
        });
    }
}

export function setCurrentWorkspace(workspace: WorkspaceState) {
    return {type: SET_CURRENT_WORKSPACE, payload: {workspace}};
}

export function setSelectedWorkspaceResourceId(selectedWorkspaceResourceId: string) {
    return (dispatch, getState) => {
        dispatch(setSelectedWorkspaceResourceIdImpl(selectedWorkspaceResourceId));
        if (selectedWorkspaceResourceId && getState().data.workspace) {
            const resources: Array<ResourceState> = getState().data.workspace.resources;
            if (resources) {
                const resource = resources.find(res => res.name === selectedWorkspaceResourceId);
                if (resource && resource.variables) {
                    dispatch(setSelectedVariableName(resource.variables[0].name));
                }
            }
        }
    }
}

function setSelectedWorkspaceResourceIdImpl(selectedWorkspaceResourceId: string) {
    return {type: SET_SELECTED_WORKSPACE_RESOURCE_ID, payload: {selectedWorkspaceResourceId}};
}

//noinspection JSUnusedGlobalSymbols
export function setSelectedWorkflowStepId(selectedWorkflowStepId: string) {
    return {type: SET_SELECTED_WORKFLOW_STEP_ID, payload: {selectedWorkflowStepId}};
}

function workspaceAPI(state: State): WorkspaceAPI {
    return new WorkspaceAPI(state.data.appConfig.webAPIClient);
}

export function setWorkspaceResource(resName: string, opName: string, opArgs: any, title: string) {
    return (dispatch, getState) => {
        const baseDir = getState().data.workspace.baseDir;

        const jobPromise = workspaceAPI(getState()).setWorkspaceResource(baseDir, resName, opName, opArgs,
            (progress: JobProgress) => {
                dispatch(jobProgress(progress));
            });
        dispatch(jobSubmitted(jobPromise.getJobId(), title));
        jobPromise.then(workspace => {
            dispatch(jobDone(jobPromise.getJobId()));
            dispatch(setCurrentWorkspace(workspace));
            dispatch(setSelectedWorkspaceResourceId(resName));
        }).catch(failure => {
            dispatch(jobFailed(jobPromise.getJobId(), failure));
        });
    }
}

// TODO (nf): use this in LAYERS panel to get real min/max of selected layer
export function getWorkspaceVariableStatistics(resName: string,
                                               varName: string,
                                               index: Array<number>|null,
                                               action: (statistics: ImageStatisticsState) => void) {
    return (dispatch, getState) => {
        const baseDir = getState().data.workspace.baseDir;

        const jobPromise = workspaceAPI(getState()).getWorkspaceVariableStatistics(baseDir, resName, varName, index);
        dispatch(jobSubmitted(jobPromise.getJobId(), `Computing statistics for variable "${varName}"`));
        jobPromise.then(statistics => {
            dispatch(jobDone(jobPromise.getJobId()));
            dispatch(action(statistics));
        }).catch(failure => {
            dispatch(jobFailed(jobPromise.getJobId(), failure));
        });
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Variable actions

export const SET_SELECTED_VARIABLE_NAME = 'SET_SELECTED_VARIABLE_NAME';

export function setSelectedVariableName(selectedVariableName: string|null) {
    return (dispatch, getState) => {
        dispatch(setSelectedVariableNameImpl(selectedVariableName));
        const selectedResourceName = getState().control.selectedWorkspaceResourceId;
        if (selectedResourceName && selectedVariableName) {
            const resource = getState().data.workspace.resources.find((resource: ResourceState) => resource.name == selectedResourceName);
            assert(resource, selectedResourceName);
            assert(resource.variables, selectedResourceName);

            const variable = resource.variables.find((variable: VariableState) => variable.name == selectedVariableName);
            assert(variable, selectedVariableName);

            // We need at least 2 dimensions
            if (!variable.ndim || variable.ndim < 2) {
                return;
            }

            const lastSelectedVariableLayer = getState().data.layers.find((layer: LayerState) => layer.id == SELECTED_VARIABLE_LAYER_ID);
            const restoredLayer = getState().data.savedLayers[selectedVariableName];

            let layerDisplayProperties = {};
            let varIndex;
            if (restoredLayer) {
                varIndex = restoredLayer.varIndex;
                layerDisplayProperties = null;
            } else {
                varIndex = null;
                layerDisplayProperties = {
                    colorMapName: 'jet',
                    displayMin: 0.,
                    displayMax: 1.,
                    alphaBlending: false,
                    imageEnhancement: {
                        alpha: 1.0,
                        brightness: 1.0,
                        contrast: 1.0,
                        hue: 0.0,
                        saturation: 1.0,
                        gamma: 1.0,
                    },
                };
            }

            if (!varIndex || varIndex.length != variable.ndim - 2) {
                varIndex = Array(variable.ndim - 2).fill(0);
            }

            const currentSelectedVariableLayer = Object.assign({}, restoredLayer, {
                id: SELECTED_VARIABLE_LAYER_ID,
                type: 'VariableImage' as any,
                name: selectedResourceName + '.' + selectedVariableName,
                show: true,
                resName: selectedResourceName,
                varName: selectedVariableName,
                varIndex,
            });

            if (lastSelectedVariableLayer) {
                dispatch(saveLayer(selectedVariableName, lastSelectedVariableLayer));
            }

            dispatch(updateLayer(currentSelectedVariableLayer));
            dispatch(setSelectedLayerId(currentSelectedVariableLayer.id));
        }
    }
}

function setSelectedVariableNameImpl(selectedVariableName: string|null) {
    return {type: SET_SELECTED_VARIABLE_NAME, payload: {selectedVariableName}};
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Layer actions

export const SET_SELECTED_LAYER_ID = 'SET_SELECTED_LAYER_ID';
export const UPDATE_LAYER = 'UPDATE_LAYER';
export const SAVE_LAYER = 'SAVE_LAYER';

export const SELECTED_VARIABLE_LAYER_ID = 'selectedVariable';

export function setSelectedLayerId(selectedLayerId: string|null) {
    return {type: SET_SELECTED_LAYER_ID, payload: {selectedLayerId}};
}

export function updateLayer(layer: LayerState) {
    return {type: UPDATE_LAYER, payload: {layer}};
}

export function updateLayerVisibility(layer: LayerState, show: boolean) {
    updateLayer(Object.assign({}, layer, {show}));
}

export function updateLayerImageEnhancement(layer: ImageLayerState, name: string, value: number) {
    const imageEnhancement = Object.assign({}, layer.imageEnhancement, {[name]: value});
    const changedLayer = Object.assign({}, layer, {imageEnhancement});
    return updateLayer(changedLayer);
}

export function updateLayerImageStatistics(layer: VariableImageLayerState, newStatistics: any) {
    const statistics = Object.assign({}, layer.statistics, newStatistics);
    const changedLayer = Object.assign({}, layer, {statistics});
    return updateLayer(changedLayer);
}

export function saveLayer(variableName: string, layer: VariableImageLayerState) {
    return {type: SAVE_LAYER, payload: {variableName, layer}};
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ColorMap actions

export const UPDATE_COLOR_MAPS = 'UPDATE_COLOR_MAPS';
export const SET_SELECTED_COLOR_MAP_NAME = 'SET_SELECTED_COLOR_MAP_NAME';


function colorMapsAPI(state: State): ColorMapsAPI {
    return new ColorMapsAPI(state.data.appConfig.webAPIClient);
}

/**
 * Asynchronously load the initial workspace.
 * Called only a single time on app initialisation.
 *
 * @returns {(dispatch:any, getState:any)=>undefined}
 */
export function loadColorMaps() {
    return (dispatch, getState: () => State) => {
        let jobPromise = colorMapsAPI(getState()).getColorMaps();
        dispatch(jobSubmitted(jobPromise.getJobId(), "Loading Color Maps"));
        jobPromise.then((colorMaps: Array<ColorMapCategoryState>) => {
            dispatch(updateColorMaps(colorMaps));
        }).catch(failure => {
            dispatch(jobFailed(jobPromise.getJobId(), failure));
        });
    }
}

function updateColorMaps(colorMaps: Array<ColorMapCategoryState>) {
    return {type: UPDATE_COLOR_MAPS, payload: {colorMaps}};
}

function setSelectedColorMapNameImpl(selectedColorMapName: string|null) {
    return {type: SET_SELECTED_COLOR_MAP_NAME, payload: {selectedColorMapName}};
}

