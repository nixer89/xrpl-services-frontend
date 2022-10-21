import { Component, OnInit } from '@angular/core';
import { XummService } from '../services/xumm.service';

@Component({
  selector: 'statistics',
  templateUrl: './statistics.html',
  styleUrls: ['./statistics.css']
})
export class Statistics implements OnInit {
  
  constructor(private xummApi: XummService) {}

  statisticsWeb:any[] = [];
  statisticsEscrow:any[] = [];
  statisticsToken:any[] = [];
  statisticsNFT:any[] = [];
  statisticsTokenTrasher:any[] = [];
  
  totalTransactionsWeb:number = 0
  totalTransactionsEscrow:number = 0
  totalTransactionsToken:number = 0
  totalTransactionsNFT:number = 0;
  totalTransactionsTokenTrasher:number = 0;

  escrowNextRelease:Date;
  escrowLastRelease:Date;
  escrowCurrentCount:number = -1;

  displayedColumns: string[] = ['transactiontype', 'number'];
  loading:boolean = false;

  async ngOnInit() {
    this.loading = true;
    let promises:any[] = [];
    promises.push(this.xummApi.getTransactionStatistics());
    promises.push(this.xummApi.getTransactionStatistics("https://escrowcreate-xapp.xrpl.services"));
    promises.push(this.xummApi.getTransactionStatistics("https://tokencreate-xapp.xrpl.services"));
    promises.push(this.xummApi.getEscrowNextRelease());
    promises.push(this.xummApi.getEscrowLastRelease());
    promises.push(this.xummApi.getEscrowCurrentCount());
    promises.push(this.xummApi.getTransactionStatistics("https://nftcreate-xapp.xrpl.services"));
    promises.push(this.xummApi.getTransactionStatistics("https://tokentrasher-xapp.xrpl.services"));


    let results = await Promise.all(promises);

    let statsWeb = results[0];
    let statsEscrow = results[1];
    let statsToken = results[2];
    this.escrowNextRelease = results[3] != null ? new Date(results[3]) : null;
    this.escrowLastRelease = results[4] != null ? new Date(results[4]) : null;
    this.escrowCurrentCount = results[5];
    let statsNFT = results[6];
    let statsTrasher = results[7];

    this.calculateStats(statsWeb, this.statisticsWeb, this.totalTransactionsWeb);
    this.calculateStats(statsEscrow, this.statisticsEscrow, this.totalTransactionsEscrow);
    this.calculateStats(statsToken, this.statisticsToken, this.totalTransactionsToken);
    this.calculateStats(statsNFT, this.statisticsNFT, this.totalTransactionsNFT);
    this.calculateStats(statsTrasher, this.statisticsTokenTrasher, this.totalTransactionsTokenTrasher);

    this.loading = false;
  }

  calculateStats(apiResult: any, statsArray: any[], totalTransaction: number) {
    if(apiResult) {
      //console.log("received stats: " + JSON.stringify(apiResult));
      for(let trx in apiResult) {
        if (apiResult.hasOwnProperty(trx)) {

          let readableName = this.resolveTransactionName(trx);
          let readableStats = {
            name: readableName,
            number: apiResult[trx]
          };

          totalTransaction += apiResult[trx];
          statsArray.push(readableStats);
        }
      }

      if(statsArray && statsArray.length > 1)
        statsArray.sort((trx1, trx2 ) => { return trx2.number - trx1.number });

      statsArray.push({name: "Overall # of Trx", number: totalTransaction});

      //console.log("constructed stats array: " + JSON.stringify(statsArray));
    }
  }

  resolveTransactionName(deliveredName: string) {
    switch(deliveredName.toLowerCase()) {
      case "signin":                return "Sign In";
      case "accountset":            return "Account Set";
      case "accountdelete":         return "Account Delete";
      case "checkcancel":           return "Cancel Check";
      case "checkcash":             return "Cash Check";
      case "checkcreate":           return "Create Check";
      case "depositpreauth":        return "Deposit Preauth";
      case "escrowcancel":          return "Cancel Escrow";
      case "escrowcreate":          return "Create Escrow";
      case "escrowfinish":          return "Finish Escrow";
      case "offercancel":           return "Cancel Offer";
      case "offercreate":           return "Create Offer";
      case "payment":               return "Payment";
      case "paymentchannelclaim":   return "Claim Paymentchannel";
      case "paymentchannelcreate":  return "Create Paymentchannel";
      case "paymentchannelfund":    return "Fund Paymentchannel";
      case "setregularkey":         return "Set Regular Key";
      case "signerlistset":         return "Set Signer List";
      case "ticketcreate":          return "Create Ticket";
      case "trustset":              return "TrustSet";
      case "nftokenacceptoffer":    return "NFToken Accept Offer";
      case "nftokenburn":           return "NFToken Burn";
      case "nftokencanceloffer":    return "NFToken Cancel Offer";
      case "nftokencreateoffer":    return "NFToken Create Offer";
      case "nftokenmint":           return "NFToken Mint";
      default:                      return deliveredName;
    }
  }
}
