import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Injectable, Optional, SkipSelf } from '@angular/core';

@Injectable()
export class XRPLWebsocket {
    
    websocket: WebSocketSubject<any>;
    originalTestModeValue:boolean = false;
    liveNodes:string[] = ['wss://xrpl.ws', 'wss://s2.ripple.com'];
    testNodes:string[] = ['wss://testneto.xrpl-labs.com', 'wss://s.altnet.rippletest.net'];
    liveFirst:boolean = true;
    testFirst:boolean = true;

    constructor (@Optional() @SkipSelf() parentModule?: XRPLWebsocket) {
        if (parentModule) {
          throw new Error(
            'XRPLWebsocket is already loaded. Import it in the AppModule only');
        }
    }

    getWebsocketMessage(command:any, newTestMode:boolean, retry?:boolean): Promise<any> {

        if(this.websocket && this.originalTestModeValue != newTestMode) {
            //console.log("test mode changed")
            this.websocket.unsubscribe();
            this.websocket.complete();
            this.websocket = null;
        }

        if(!this.websocket || this.websocket.closed) {

            this.originalTestModeValue = newTestMode;
            console.log("connecting websocket with testmode: " + this.originalTestModeValue);
            this.websocket = webSocket(this.originalTestModeValue ? (this.testFirst ? this.testNodes[0] : this.testNodes[1]) : (this.liveFirst ? this.liveNodes[0] : this.liveNodes[1]));
        }

        return new Promise((resolve, reject) => {
            this.websocket.asObservable().subscribe(async message => {
                resolve(message);
            }, async error => {
                this.websocket.complete();
                this.websocket = null;
                
                if(!retry) {
                    console.log("could not connect websocket! changing node!");
                    resolve(await this.connectToSecondWS(command));
                } else {
                    resolve({error: true, message: "No node connection possible"});
                }
            });

            this.websocket.next(command);
        });        
    }

    connectToSecondWS(command): Promise<any> {
        if(this.originalTestModeValue)
            this.testFirst = !this.testFirst;
        else
            this.liveFirst = !this.liveFirst;

        return this.getWebsocketMessage(command, this.originalTestModeValue, true);
    }
}

