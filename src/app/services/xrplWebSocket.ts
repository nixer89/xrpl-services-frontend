import { webSocket } from 'rxjs/webSocket';
import { Injectable, Optional, SkipSelf } from '@angular/core';

@Injectable()
export class XRPLWebsocket {
    
    originalTestModeValue:boolean = false;
    mainNodes:string[] = ['wss://xrplcluster.com', 'wss://s2.ripple.com'];
    testNodes:string[] = ['wss://testnet.xrpl-labs.com', 'wss://s.altnet.rippletest.net'];
    mainFirst:boolean = true;
    testFirst:boolean = true;
    errorsToSwitch:string[] = ["amendmentBlocked", "failedToForward", "invalid_API_version", "noClosed", "noCurrent", "noNetwork", "tooBusy"]

    websocketMap:Map<string, any> = new Map();

    constructor (@Optional() @SkipSelf() parentModule?: XRPLWebsocket) {
        if (parentModule) {
          throw new Error(
            'XRPLWebsocket is already loaded. Import it in the AppModule only');
        }
    }

    async getWebsocketMessage(componentname:string, command:any, newTestMode:boolean, retry?:boolean): Promise<any> {

        if(this.websocketMap.get(componentname) && this.websocketMap.get(componentname).mode != newTestMode) {
            //console.log("test mode changed")
            this.websocketMap.get(componentname).socket.unsubscribe();
            this.websocketMap.get(componentname).socket.complete();
            this.websocketMap.delete(componentname)

            //console.log("websockets: " + this.websocketMap.size);
        }

        if(!this.websocketMap.get(componentname) || this.websocketMap.get(componentname).socket.closed) {

            this.originalTestModeValue = newTestMode;
            console.log("connecting websocket with testmode: " + this.originalTestModeValue);
            let newWebsocket = webSocket(this.originalTestModeValue ? (this.testFirst ? this.testNodes[0] : this.testNodes[1]) : (this.mainFirst ? this.mainNodes[0] : this.mainNodes[1]));

            this.websocketMap.set(componentname, {socket: newWebsocket, mode: newTestMode, isBusy: false});

            //console.log("websockets: " + this.websocketMap.size);
        }

        return new Promise((resolve, reject) => {
            this.websocketMap.get(componentname).socket.asObservable().subscribe(async message => {
                console.log(JSON.stringify(message));
                
                if(message && message.error && this.errorsToSwitch.includes(message.error)) {
                    resolve(await this.cleanupAndChangeNode(componentname, command, retry));    
                } else {
                    resolve(message);
                }               
            }, async error => {
                resolve(await this.cleanupAndChangeNode(componentname, command, retry));
            });

            console.log("setting up command: " + JSON.stringify(command))
            this.websocketMap.get(componentname).socket.next(command);
        });        
    }

    async cleanupAndChangeNode(componentname: string, command: any, retry: boolean): Promise<any> {
        this.websocketMap.get(componentname).socket.complete();
        this.websocketMap.delete(componentname)
        
        if(!retry) {
            console.log("could not connect websocket! changing node!");
            return this.connectToSecondWS(componentname, command);
        } else {
            return {error: true, message: "No node connection possible"};
        }
    }

    async connectToSecondWS(componentname:string, command:any): Promise<any> {
        if(this.originalTestModeValue)
            this.testFirst = !this.testFirst;
        else
            this.mainFirst = !this.mainFirst;

        return this.getWebsocketMessage(componentname, command, this.originalTestModeValue, true);
    }

    async send(command:any): Promise<any> {
        console.log("offers command: " + JSON.stringify(command));
        
        return this.getWebsocketMessage("liquidity-check", command, false)
    }
}

