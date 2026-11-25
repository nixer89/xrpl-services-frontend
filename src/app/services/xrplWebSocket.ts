import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
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
    requestCounter:number = 0;
    requestTimeoutMs:number = 30000;

    constructor (@Optional() @SkipSelf() parentModule?: XRPLWebsocket) {
        if (parentModule) {
          throw new Error(
            'XRPLWebsocket is already loaded. Import it in the AppModule only');
        }
    }

    async getWebsocketMessage(componentname:string, command:any, newTestMode:boolean, retry?:boolean): Promise<any> {

        let entry:any = this.websocketMap.get(componentname);

        if(entry && entry.mode != newTestMode) {
            //console.log("test mode changed")
            //requests still waiting on the old network can not be answered anymore
            this.closeEntry(componentname, entry, {error: true, message: "Network changed"});
            entry = null;

            //console.log("websockets: " + this.websocketMap.size);
        }

        if(!entry || entry.socket.closed) {

            if(entry)
                this.closeEntry(componentname, entry, {error: true, message: "No node connection possible"});

            this.originalTestModeValue = newTestMode;
            console.log("connecting websocket with testmode: " + newTestMode);
            let url:string = newTestMode ? (this.testFirst ? this.testNodes[0] : this.testNodes[1]) : (this.mainFirst ? this.mainNodes[0] : this.mainNodes[1]);
            let newWebsocket:WebSocketSubject<any> = webSocket(url);

            entry = {socket: newWebsocket, mode: newTestMode, url: url, isBusy: false, pending: new Map<string, any>(), dead: false};
            this.websocketMap.set(componentname, entry);

            //ONE subscription per socket. Answers are matched to their request by "id".
            let thisEntry:any = entry;
            newWebsocket.asObservable().subscribe(message => {
                //console.log(JSON.stringify(message));
                let request:any = (message && message.id != null) ? thisEntry.pending.get(message.id) : null;

                if(!request)
                    return;

                if(message.error && this.errorsToSwitch.includes(message.error)) {
                    this.failEntry(componentname, thisEntry);
                } else {
                    thisEntry.pending.delete(message.id);
                    clearTimeout(request.timer);
                    request.resolve(message);
                }
            }, error => {
                this.failEntry(componentname, thisEntry);
            }, () => {
                //socket closed by the node
                this.failEntry(componentname, thisEntry);
            });

            //console.log("websockets: " + this.websocketMap.size);
        }

        return new Promise((resolve, reject) => {
            let usedEntry:any = entry;
            let id:string = "xs-" + (++this.requestCounter);

            let timer = setTimeout(() => {
                //node did not answer in time -> handle like a broken connection
                if(usedEntry.pending.has(id))
                    this.failEntry(componentname, usedEntry);
            }, this.requestTimeoutMs);

            usedEntry.pending.set(id, {resolve: resolve, command: command, retry: retry, timer: timer});

            //console.log("setting up command: " + JSON.stringify(command))
            //do not change the object of the caller, it may be reused (paging with marker)
            usedEntry.socket.next(Object.assign({}, command, {id: id}));
        });        
    }

    private closeEntry(componentname:string, entry:any, answer:any) {
        if(entry.dead)
            return;

        entry.dead = true;

        if(this.websocketMap.get(componentname) === entry)
            this.websocketMap.delete(componentname);

        let pending:any[] = Array.from(entry.pending.values());
        entry.pending.clear();

        try {
            entry.socket.unsubscribe();
            entry.socket.complete();
        } catch(err) {
            //socket already closed
        }

        for(let i = 0; i < pending.length; i++) {
            clearTimeout(pending[i].timer);
            pending[i].resolve(answer);
        }
    }

    //the node of this socket failed: close it, prefer the other node and repeat the open requests ONCE
    private failEntry(componentname:string, entry:any) {
        if(entry.dead)
            return;

        entry.dead = true;

        if(this.websocketMap.get(componentname) === entry)
            this.websocketMap.delete(componentname);

        let pending:any[] = Array.from(entry.pending.values());
        entry.pending.clear();

        try {
            entry.socket.complete();
        } catch(err) {
            //socket already closed
        }

        if(pending.length > 0) {
            console.log("could not connect websocket! changing node!");

            //select the node which did NOT fail (not a toggle, so many failing requests can not switch back)
            if(entry.mode)
                this.testFirst = entry.url != this.testNodes[0];
            else
                this.mainFirst = entry.url != this.mainNodes[0];
        }

        for(let i = 0; i < pending.length; i++) {
            clearTimeout(pending[i].timer);

            if(!pending[i].retry) {
                //retry with the mode of the failed request itself
                pending[i].resolve(this.getWebsocketMessage(componentname, pending[i].command, entry.mode, true));
            } else {
                pending[i].resolve({error: true, message: "No node connection possible"});
            }
        }
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

                //one socket per call: close it after the answer
                newWebsocket.complete();
            }, async error => {
                reject("error");
            });

            //console.log("setting up command: " + JSON.stringify(command))
            newWebsocket.next(command);
        }); 
    }
}

