import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Injectable, Optional, SkipSelf } from '@angular/core';

@Injectable()
export class XRPLWebsocket {
    
    websocket: WebSocketSubject<any>;
    originalTestModeValue:boolean = false;

    constructor (@Optional() @SkipSelf() parentModule?: XRPLWebsocket) {
        if (parentModule) {
          throw new Error(
            'XRPLWebsocket is already loaded. Import it in the AppModule only');
        }
    }

    getWebsocketMessage(command:any, newTestMode:boolean): Promise<any> {

        if(this.websocket && this.originalTestModeValue != newTestMode) {
            //console.log("test mode changed")
            this.websocket.unsubscribe();
            this.websocket.complete();
            this.websocket = null;
        }

        if(!this.websocket || this.websocket.closed) {

            this.originalTestModeValue = newTestMode;
            //console.log("connecting websocket");
            this.websocket = webSocket(this.originalTestModeValue ? 'wss://testnet.xrpl-labs.com' : 'wss://xrpl.ws');
        }

        return new Promise((resolve, reject) => {
            this.websocket.asObservable().subscribe(async message => {
                resolve(message);
            });

            this.websocket.next(command);
        });        
    }
}

