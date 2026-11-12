import { Injectable } from '@angular/core';

export interface AppConfigInterface {
  idleConfig: {
    idle: number;
    timeout: number;
    ping: number;
  };
  refreshTime: number;
  plotColorway: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AppConfig {
  config: AppConfigInterface = {
    idleConfig: {
      idle: 840,
      timeout: 60,
      ping: 300,
    },
    refreshTime: 10,
    plotColorway: [
      '#EA80FC',
      '#FFC124',
      '#673AB7',
      '#00BCD4',
      '#FF80AB',
      '#2196F3',
      '#FFD180',
      '#65FCDA',
      '#B388FC',
      '#FF981A',
      '#8C9EFD',
      '#FF5722',
      '#80D8FE',
      '#FF9E80',
      '#84FDFF',
      '#795648',
      '#FFE57F',
      '#019688',
      '#BDBDBD',
      '#3F51B4',
      '#D7CCC8',
      '#546E7A',
      '#CFD8DC',
      '#708090',
      '#2F4F4F',
      '#aaffaa',
    ],
  };
}
