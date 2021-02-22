import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

declare let gtag:Function;

@Injectable({
  providedIn: 'root'
})
export class GoogleAnalyticsService {

  constructor() { }

  public analyticsEventEmitter(eventAction: string, eventCategory: string, eventLabel: string,  eventValue: number = null ) {
    if(environment.production) {
      gtag('event', eventAction, { 
              event_category: eventCategory, 
              event_label: eventLabel, 
              value: eventValue
      });
    }
  }
}
