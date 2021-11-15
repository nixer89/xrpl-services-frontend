import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Injectable, Optional, SkipSelf } from '@angular/core';
import { XRPLWebSocketType } from '../utils/types';

@Injectable()
export class XRPLWebsocket {
    
    originalTestModeValue:boolean = false;
    mainNodes:string[] = ['wss://xrplcluster.com', 'wss://s2.ripple.com'];
    testNodes:string[] = ['wss://testnet.xrpl-labs.com', 'wss://s.altnet.rippletest.net'];
    mainFirst:boolean = true;
    testFirst:boolean = true;
    errorsToSwitch:string[] = ["amendmentBlocked", "failedToForward", "invalid_API_version", "noClosed", "noCurrent", "noNetwork", "tooBusy"]

    websocketArray:XRPLWebSocketType[] = [];

    constructor (@Optional() @SkipSelf() parentModule?: XRPLWebsocket) {
        if (parentModule) {
          throw new Error(
            'XRPLWebsocket is already loaded. Import it in the AppModule only');
        }

        let randomNumber:number = Math.floor(Math.random() * (1 - 100) + 100)
        console.log("random number: " + randomNumber);
        this.mainFirst = randomNumber % 2 == 0;
        this.testFirst = randomNumber % 2 == 0;

        console.log("mainFirst: " + this.mainFirst);
    }

    async getWebsocketMessage(command:any, newTestMode:boolean, retry?: boolean): Promise<any> {

        let websocketToUse:XRPLWebSocketType = null;

        for(let i = 0; i < this.websocketArray.length; i++) {
            console.log("websocket " + i + " busy: " + (this.websocketArray[i] != null && this.websocketArray[i].isBusy));

            if(this.websocketArray[i] && this.websocketArray[i].mode === newTestMode && !this.websocketArray[i].socket.closed && !this.websocketArray[i].isBusy) {
                this.websocketArray[i].isBusy = true;
                websocketToUse = this.websocketArray[i];
                break;
            } else if(this.websocketArray[i].socket.closed) {
                //delete closed socket
                this.websocketArray.splice(i,1);
            }
        }

        if(websocketToUse == null) {
            
            //open new websocket!
            this.originalTestModeValue = newTestMode;
            console.log("connecting websocket with testmode: " + JSON.stringify(this.originalTestModeValue));

            let socket = webSocket(this.originalTestModeValue ? (this.testFirst ? this.testNodes[0] : this.testNodes[1]) : (this.mainFirst ? this.mainNodes[0] : this.mainNodes[1]));
            
            websocketToUse = {
                socket: socket,
                isBusy: true,
                mode: newTestMode
            }

            this.websocketArray.push(websocketToUse);

            console.log("websockets: " + this.websocketArray.length);

        }

        return new Promise((resolve, reject) => {
            websocketToUse.socket.asObservable().subscribe(async message => {
                //console.log(JSON.stringify(message));
                if(message && message.error && this.errorsToSwitch.includes(message.error)) {
                    resolve(await this.cleanupAndChangeNode(websocketToUse, command, retry));    
                } else {
                    websocketToUse.isBusy = false;
                    resolve(message);
                }               
            }, async error => {
                resolve(await this.cleanupAndChangeNode(websocketToUse, command, retry));
            });

            //console.log("setting up command: " + JSON.stringify(command))
            websocketToUse.socket.next(command);
        });        
    }

    async cleanupAndChangeNode(websocketToUse: XRPLWebSocketType, command: any, retry: boolean): Promise<any> {
        websocketToUse.socket.complete();
        websocketToUse.isBusy = false
        
        if(!retry) {
            console.log("could not connect websocket! changing node!");
            return this.connectToSecondWS(command);
        } else {
            return {error: true, message: "No node connection possible"};
        }
    }

    async connectToSecondWS( command:any): Promise<any> {
        if(this.originalTestModeValue)
            this.testFirst = !this.testFirst;
        else
            this.mainFirst = !this.mainFirst;

        return this.getWebsocketMessage(command, this.originalTestModeValue, true);
    }

    async send(command:any): Promise<any> {
        //console.log("offers command: " + JSON.stringify(command));

        let newWebsocket:WebSocketSubject<any> = webSocket('wss://xrplcluster.com');

        return new Promise((resolve, reject) => {
            newWebsocket.asObservable().subscribe(async message => {
                //console.log(JSON.stringify(message));
                
                if(message && message.error) {
                    reject("error");    
                } else {
                    resolve(message.result);
                }               
            }, async error => {
                reject("error");
            });

            //console.log("setting up command: " + JSON.stringify(command))
            newWebsocket.next(command);
        }); 
    }
}

