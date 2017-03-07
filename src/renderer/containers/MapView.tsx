import * as React from 'react';
import {
    LayerState, State, WorkspaceState, VariableImageLayerState, VariableVectorLayerState,
    VariableRefState, VariableState, ResourceState, VectorLayerState
} from "../state";
import {OpenLayersMap, LayerDescriptor} from "../components/openlayers/OpenLayersMap";
import {connect} from "react-redux";
import * as actions from "../actions";
import * as ol from 'openlayers';

interface IMapViewProps {
    baseUrl: string;
    workspace: WorkspaceState | null;
    offlineMode: boolean;
    layers: LayerState[];
    projectionCode: string;
}

function mapStateToProps(state: State): IMapViewProps {
    return {
        baseUrl: state.data.appConfig.webAPIConfig.restUrl,
        workspace: state.data.workspace,
        offlineMode: state.session.offlineMode,
        layers: state.data.layers,
        projectionCode: state.control.projectionCode,
    };
}

/**
 * This component displays a 2D map with a number of layers.
 */
class MapView extends React.Component<IMapViewProps, null> {

    render() {
        const mapLayers = [];
        if (this.props.workspace && this.props.workspace.resources && this.props.layers) {
            for (let layer of this.props.layers) {
                let mapLayer;
                switch (layer.type) {
                    case 'VariableImage':
                        mapLayer = this.convertVariableImageLayerToMapLayer(layer as VariableImageLayerState);
                        break;
                    case 'VariableVector':
                        mapLayer = this.convertVariableVectorLayerToMapLayer(layer as VariableVectorLayerState);
                        break;
                    case 'Vector':
                        mapLayer = this.convertVectorLayerToMapLayer(layer as VectorLayerState);
                        break;
                }
                if (mapLayer) {
                    mapLayers.push(mapLayer);
                } else {
                    console.warn(`MapView: layer with ID "${layer.id}" will not be rendered`);
                }
            }
        }

        return (
            <div style={{width:"100%", height:"100%"}}>
                <OpenLayersMap id="defaultMapView"
                               debug={true}
                               projectionCode={this.props.projectionCode}
                               layers={mapLayers}
                               offlineMode={this.props.offlineMode}
                               style={{width:"100%", height:"100%"}}/>
                <div id="creditContainer" style={{display:"none"}}></div>
            </div>
        );
    }

    private getResource(ref: VariableRefState): ResourceState {
        return actions.findResource(this.props.workspace.resources, ref);
    }

    private getVariable(ref: VariableRefState): VariableState {
        return actions.findVariable(this.props.workspace.resources, ref);
    }

    private convertVariableImageLayerToMapLayer(layer: VariableImageLayerState): LayerDescriptor|null {
        const variable = this.getVariable(layer);
        if (!variable) {
            console.warn(`MapView: variable "${layer.varName}" not found in resource "${layer.resName}"`);
            return null;
        }
        const imageLayout = variable.imageLayout;
        if (!variable.imageLayout) {
            console.warn(`MapView: variable "${layer.varName}" of resource "${layer.resName}" has no imageLayout`);
            return null;
        }
        const baseDir = this.props.workspace.baseDir;
        const url = actions.getTileUrl(this.props.baseUrl, baseDir, layer);
        let extent: ol.Extent = [-180, -90, 180, 90];
        if (imageLayout.sector) {
            const sector = imageLayout.sector;
            extent = [sector.west, sector.south, sector.east, sector.north];
        }
        const startResolution = 360. / (imageLayout.numLevelZeroTilesX * imageLayout.tileWidth);
        const resolutions = new Array<number>(imageLayout.numLevels);
        for (let i = 0; i < resolutions.length; i++) {
            resolutions[i] = startResolution / Math.pow(2, i);
        }
        const origin: ol.Coordinate = [-180, 90];
        const tileSize: [number, number] = [imageLayout.tileWidth, imageLayout.tileHeight];
        // see https://openlayers.org/en/latest/apidoc/ol.source.XYZ.html
        return {
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            layerFactory: createTileLayer,
            layerSourceOptions: {
                url,
                projection: ol.proj.get('EPSG:4326'),
                minZoom: 0,
                maxZoom: imageLayout.numLevels - 1,
                tileGrid: new ol.tilegrid.TileGrid({
                    extent,
                    origin,
                    resolutions,
                    tileSize,
                }),
            },
        };
    }

    private convertVariableVectorLayerToMapLayer(layer: VariableVectorLayerState): LayerDescriptor|null {
        const resource = this.getResource(layer);
        const variable = this.getVariable(layer);
        if (!variable) {
            console.warn(`MapView: variable "${layer.varName}" not found in resource "${layer.resName}"`);
            return null;
        }
        const baseDir = this.props.workspace.baseDir;
        const url = actions.getGeoJSONUrl(this.props.baseUrl, baseDir, layer);

        const streamFeatures = function (extend: ol.Extent, resolution: number, projection: ol.proj.Projection) {
            const source = (this as any) as ol.source.Vector;
            console.log('streamFeatures #1:', source, extend, resolution, projection);

            const geoJSONFormat = new ol.format.GeoJSON({
                defaultDataProjection: 'EPSG:4326',
                featureProjection: projection
            });

            //let code = FeatureLoader.toString();
            //code = code.substring(code.indexOf("{") + 1, code.lastIndexOf("}"));
            //console.log('code:', code);
            //const codeUrl = URL.createObjectURL(new Blob([code], {type: "application/javascript"}));
            //const codeUrl = "data:application/javascript;utf8," + code;
            const codeUrl = "renderer/containers/stream-features.js";
            const worker = new Worker(codeUrl);
            worker.postMessage(url);
            worker.onmessage = function (event: MessageEvent) {
                const features = geoJSONFormat.readFeatures({type: 'FeatureCollection', features: event.data});
                source.addFeatures(features);
            };

            console.log('streamFeatures #2:', source, extend, resolution, projection);
        };

        const layerSourceOptions = {
            loader: streamFeatures,
        };

        const layerFactory = (layerSourceOptions) => {
            return new ol.layer.Vector({
                source: new ol.source.Vector(layerSourceOptions)
            });
        };

        return {
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            layerFactory,
            layerSourceOptions,
        };
    }

    private convertVectorLayerToMapLayer(layer: VectorLayerState): LayerDescriptor|null {
        let url = layer.url;
        if (layer.id === actions.COUNTRY_BORDERS_LAYER_ID) {
            url = actions.getGeoJSONCountriesUrl(this.props.baseUrl);
        }
        return {
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            layerFactory: createGeoJSONLayer,
            layerSourceOptions: {url},
        };
    }
}

export default connect(mapStateToProps)(MapView);


function createTileLayer(sourceOptions: olx.source.XYZOptions) {
    const tileSource = new ol.source.XYZ(sourceOptions);
    tileSource.on("loaderror", (event) => {
        console.error('MapView:', event);
    }, this);
    // see https://openlayers.org/en/latest/apidoc/ol.layer.Tile.html
    return new ol.layer.Tile({source: tileSource});
}

function createGeoJSONLayer(sourceOptions: olx.source.VectorOptions) {
    // See also http://openlayers.org/en/master/examples/geojson.html
    const vectorSource = new ol.source.Vector(Object.assign({}, sourceOptions, {
        format: new ol.format.GeoJSON({
            defaultDataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:4326'
        })
    }));
    return new ol.layer.Vector({source: vectorSource});
}

function styleFunction(feature: ol.Feature) {
    //noinspection UnnecessaryLocalVariableJS
    let undef;
    return undef;
}
