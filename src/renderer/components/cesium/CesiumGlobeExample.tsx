import * as React from 'react';
import {CesiumGlobe} from './CesiumGlobe';
import {ICity, CesiumCityList} from './cities';

// TODO: only used to get electron.app.getAppPath
const {app} = require('electron').remote;

interface ICesiumViewProps {
    id: string;
}

interface ICesiumViewState {
    cities: Array<ICity>;
}

/**
 * An example of CesiumGlobe that displays some cities.
 */
export class CesiumGlobeExample extends React.Component<ICesiumViewProps, ICesiumViewState> {
    constructor(props: ICesiumViewProps) {
        super(props);
        //noinspection JSFileReferences
        this.state = {
            cities: require(app.getAppPath() + '/resources/data/top10cities.json')
        };
    }

    private handleCheckboxChange(event) {
        let cities = this.state.cities;
        let newCities = cities.map((city) => {
            let visible = (city.id === event.target.value) ? event.target.checked : city.visible;
            return {
                id: city.id,
                name: city.name,
                state: city.state,
                latitude: city.latitude,
                longitude: city.longitude,
                visible: visible
            }
        });
        this.setState({
            cities: newCities
        })
    }

    render() {
        return (
            <div style={{width:"100%", height:"100%"}}>
                <CesiumGlobe id={this.props.id}
                             debug={true}
                             offlineMode={false}
                             style={{width:"100%", height:"100%"}}
                             cities={this.state.cities}/>
                {/*<CesiumCityList cities={this.state.cities} onChange={this.handleCheckboxChange.bind(this)}/>*/}
                <div id="creditContainer" style={{display:"none"}}></div>
            </div>
        );
    }
}
