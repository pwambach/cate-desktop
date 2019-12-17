import * as React from 'react';
import {DialogState, State} from '../state';
import {ModalDialog} from '../components/ModalDialog';
import {connect, DispatchProp} from 'react-redux';
import * as actions from '../actions';
import * as selectors from '../selectors';
import { ListBox, ListBoxSelectionMode } from '../components/ListBox';
import { Checkbox } from '@blueprintjs/core';

interface IChooseWorkspaceDialogState extends DialogState {
    workspaceDir: string | null;
    workspaceName: string;
    deleteEntireWorkspace: boolean;
}

interface IChooseWorkspaceDialogOwnProps {
    dialogId: string;
}

interface IChooseWorkspaceDialogProps extends IChooseWorkspaceDialogState, IChooseWorkspaceDialogOwnProps {
    isOpen: boolean;
    isLocalWebAPI: boolean;
    workspaceNames: string[];
}

export const OPEN_WORKSPACE_DIALOG_ID = 'openWorkspaceDialog';
export const DELETE_WORKSPACE_DIALOG_ID = 'deleteWorkspaceDialog';

function mapStateToProps(state: State, ownProps: IChooseWorkspaceDialogOwnProps): IChooseWorkspaceDialogProps {
    const dialogState = selectors.dialogStateSelector(ownProps.dialogId)(state) as any;
    const isOpen = dialogState.isOpen;
    const dialogId = ownProps.dialogId;
    const isLocalWebAPI = selectors.isLocalWebAPISelector(state);
    let workspaceDir = dialogState.workspaceDir;
    let workspaceName = dialogState.workspaceName;
    if (isOpen) {
        if (!selectors.isScratchWorkspaceSelector(state)) {
            workspaceDir = workspaceDir || selectors.workspaceDirSelector(state);
            workspaceName = workspaceName || selectors.workspaceNameSelector(state);
        }
        workspaceDir = workspaceDir || selectors.lastWorkspaceDirSelector(state);
    }
    workspaceDir = isLocalWebAPI ? workspaceDir || '' : null;
    workspaceName = workspaceName || '';
    let workspaceNames: string[];
    if (state.data.workspace && state.data.workspaceNames) {
        let workspaceBaseDir = state.data.workspace.baseDir;
        let lastIndexOf = workspaceBaseDir.lastIndexOf('\\');
        if (lastIndexOf < 0) {
            lastIndexOf = workspaceBaseDir.lastIndexOf('/');
        }
        let name = workspaceBaseDir.substr(lastIndexOf + 1);
        workspaceNames = [...state.data.workspaceNames];
        let indexOf = workspaceNames.indexOf(name);
        if (indexOf > -1) {
            workspaceNames.splice(indexOf, 1);
        }
    }
    return {
        workspaceDir,
        workspaceName,
        dialogId,
        isOpen,
        isLocalWebAPI,
        workspaceNames: workspaceNames,
        deleteEntireWorkspace: this.deleteEntireWorkspace
    };
}

class ChooseWorkspaceDialog extends React.Component<IChooseWorkspaceDialogProps & IChooseWorkspaceDialogOwnProps & DispatchProp<State>, IChooseWorkspaceDialogState> {

    constructor(props: IChooseWorkspaceDialogProps & DispatchProp<State>) {
        super(props);
        this.state = {workspaceDir: '', workspaceName: '', deleteEntireWorkspace: true};
        this.onCancel = this.onCancel.bind(this);
        this.onConfirm = this.onConfirm.bind(this);
        this.canConfirm = this.canConfirm.bind(this);
        this.renderBody = this.renderBody.bind(this);
        this.onWorkspaceNameChange = this.onWorkspaceNameChange.bind(this);
        this.onWorkspaceDirChange = this.onWorkspaceDirChange.bind(this);
    }

    componentWillReceiveProps(nextProps: IChooseWorkspaceDialogProps) {
        this.setState({workspaceDir: nextProps.workspaceDir, workspaceName: nextProps.workspaceName});
    }

    private onCancel() {
        this.props.dispatch(actions.hideDialog(this.props.dialogId));
    }

    private canConfirm(): boolean {
        if (!this.state.workspaceName) {
            return false;
        }
        return /^([A-Za-z_\-\s0-9.]+)$/.test(this.state.workspaceName);
    }

    private composeWorkspacePath(): string {
        let workspaceDir = this.state.workspaceDir;
        let workspaceName = this.state.workspaceName;
        if (workspaceDir === null) {
            return workspaceName;
        }
        return workspaceDir + '/' + workspaceName;
    }

    private onConfirm() {
        this.props.dispatch(actions.hideDialog(this.props.dialogId, this.state));
        if (this.props.dialogId === DELETE_WORKSPACE_DIALOG_ID) {
            this.props.dispatch(actions.deleteWorkspace(this.composeWorkspacePath(), this.state.deleteEntireWorkspace));
        } else {
            this.props.dispatch(actions.openWorkspace(this.composeWorkspacePath()));
        }
    }

    private setSelectedWorkspace(workspaceName: string) {
        this.setState({workspaceName});
    }

    private handleCheckboxChange(event) {
        this.setState({deleteEntireWorkspace: event.target.checked});
    }

    private onWorkspaceDirChange(ev: any) {
        this.setState({workspaceDir: ev.target.value} as IChooseWorkspaceDialogState);
    }

    private onWorkspaceNameChange(ev: any) {
        this.setState({workspaceName: ev.target.value} as IChooseWorkspaceDialogState);
    }

    render() {
        let isOpen = this.props.isOpen;
        if (!isOpen) {
            return null;
        }


        let title: string;
        let confirmTitle: string;
        if (this.props.dialogId === DELETE_WORKSPACE_DIALOG_ID) {
            title = 'Delete Workspace';
            confirmTitle = 'Delete';
        } else {
            title = 'Open Workspace';
            confirmTitle = 'Open';
        }
        return (
            <ModalDialog
                isOpen={isOpen}
                title={title}
                confirmTitle={confirmTitle}
                onCancel={this.onCancel}
                canConfirm={this.canConfirm}
                onConfirm={this.onConfirm}
                renderBody={this.renderBody}
            />);
    }

    private renderBody() {
        if (!this.props.isOpen) {
            return null;
        }

        if (this.props.workspaceNames.length === 0) {
            return (
                <div>
                    <p style={{marginTop: '1em'}}>No saved workspaces found.</p>
                </div>
            );
        }

        let checkbox: any;
        if (this.props.dialogId === DELETE_WORKSPACE_DIALOG_ID) {
            checkbox =
                // <div>
                //     <label>
                <Checkbox label={'Delete entire workspace'}
                          checked={this.state.deleteEntireWorkspace}
                          onChange={this.handleCheckboxChange.bind(this)}
                />
            // Delete entire workspace
            // </label>
            // </div>
        } else {
            checkbox = ''
        }


        return (
            <div>
                <p style={{marginTop: '1em'}}>Saved workspaces:</p>
                <ListBox items={this.props.workspaceNames}
                         selectionMode={ListBoxSelectionMode.SINGLE}
                         getItemKey={(item: any, itemIndex: number) => item}
                         onSelection={newSelection => this.setSelectedWorkspace('' + newSelection[0])}
                         selection={this.state.workspaceName}
                />
                {checkbox}
            </div>
        );
    }
}

export default connect(mapStateToProps)(ChooseWorkspaceDialog);
