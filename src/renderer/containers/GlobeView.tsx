import * as React from 'react';
import {LayerState, State, WorkspaceState, VariableImageLayerState} from "../state";
import {CesiumGlobe, CesiumImageLayer, ImageryProvider} from "../components/cesium/CesiumGlobe";
import {connect} from "react-redux";
const Cesium: any = require('cesium');

interface IGlobeViewProps {
    baseUrl: string;
    workspace: WorkspaceState | null;
    layers: Array<LayerState>;
}

function mapStateToProps(state: State): IGlobeViewProps {
    console.log("GlobeView::mapStateToProps called");
    return {
        workspace: state.data.workspace,
        layers: state.data.layers,
        baseUrl: state.data.appConfig.webAPIConfig.restUrl,
    };
}


/**
 * An example of CesiumGlobe that displays some pins.
 */
export class GlobeView extends React.Component<IGlobeViewProps, null> {

    render() {
        const cesiumImageLayers = [];
        if (this.props.workspace && this.props.workspace.resources && this.props.layers) {
            for (let layer of this.props.layers) {
                let cesiumImageLayer;
                switch (layer.type) {
                    case 'VariableImage':
                        cesiumImageLayer = this.convertVariableImageLayerToCesiumImageLayer(layer as VariableImageLayerState);
                }
                if (cesiumImageLayer) {
                    cesiumImageLayers.push(cesiumImageLayer);
                } else {
                    console.warn(`GlobeView: layer with ID "${layer.id}" will not be rendered`);
                }
            }
        }

        return (
            <div style={{width:"100%", height:"100%"}}>
                <CesiumGlobe id="defaultGlobeView"
                             debug={true}
                             imageLayers={cesiumImageLayers}
                             offlineMode={false}
                             style={{width:"100%", height:"100%"}}/>
                {/*<CesiumCityList pins={this.state.pins} onChange={this.handleCheckboxChange.bind(this)}/>*/}
                <div id="creditContainer" style={{display:"none"}}></div>
            </div>
        );
    }

    private convertVariableImageLayerToCesiumImageLayer(layer: VariableImageLayerState): CesiumImageLayer|null {
        const resource = this.props.workspace.resources.find(r => r.name === layer.resName);
        if (resource) {
            const variable = resource.variables.find(v => v.name === layer.varName);
            if (variable) {
                const imageLayout = variable.imageLayout;
                if (variable.imageLayout) {
                    const baseDir = this.props.workspace.baseDir;
                    const url = this.createVariableImageryProviderUrl(baseDir, layer);
                    return Object.assign({}, layer, {
                        imageryProvider: GlobeView.createImageryProvider,
                        imageryProviderOptions: {
                            url: url,
                            // TODO - use imageConfig.sector to specify 'rectangle' option. See backend todo.
                            // rectangle: imageLayout.sector,
                            minimumLevel: 0,
                            maximumLevel: imageLayout.numLevels - 1,
                            tileWidth: imageLayout.tileWidth,
                            tileHeight: imageLayout.tileHeight,
                            tilingScheme: new Cesium.GeographicTilingScheme({
                                numberOfLevelZeroTilesX: imageLayout.numLevelZeroTilesX,
                                numberOfLevelZeroTilesY: imageLayout.numLevelZeroTilesY
                            }),
                        },
                    });
                } else {
                    console.warn(`GlobeView: variable "${layer.varName}" of resource "${layer.resName}" has no imageLayout`);
                }
            } else {
                console.warn(`GlobeView: variable "${layer.varName}" not found in resource "${layer.resName}"`);
            }
        } else {
            console.warn(`GlobeView: resource "${layer.resName}" not found`);
        }
        return null;
    }

    private createVariableImageryProviderUrl(baseDir: string, layer: VariableImageLayerState): string {
        return this.props.baseUrl + `ws/res/tile/${encodeURIComponent(baseDir)}/${encodeURIComponent(layer.resName)}/{z}/{y}/{x}.png?`
            + `&var=${encodeURIComponent(layer.varName)}`
            + `&index=${encodeURIComponent((layer.varIndex || []).join())}`
            + `&cmap=${encodeURIComponent(layer.colorMapName) + (layer.alphaBlending ? '_alpha' : '')}`
            + `&min=${encodeURIComponent(layer.displayMin + '')}`
            + `&max=${encodeURIComponent(layer.displayMax + '')}`;
    }

    /**
     * Creates a Cesium.UrlTemplateImageryProvider instance.
     *
     * @param imageryProviderOptions see https://cesiumjs.org/Cesium/Build/Documentation/UrlTemplateImageryProvider.html
     * @returns {Cesium.UrlTemplateImageryProvider}
     */
    private static createImageryProvider(imageryProviderOptions): ImageryProvider {
        return new Cesium.UrlTemplateImageryProvider(imageryProviderOptions);
    }
}

export default connect(mapStateToProps)(GlobeView);
