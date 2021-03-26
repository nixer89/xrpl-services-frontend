import { Component, OnInit } from '@angular/core';
import { XummService } from '../services/xumm.service';

@Component({
  selector: 'statistics',
  templateUrl: './statistics.html',
  styleUrls: ['./statistics.css']
})
export class Statistics implements OnInit {
  
  constructor(private xummApi: XummService) {}

  statistics:any[] = [];
  displayedColumns: string[] = ['transactiontype', 'number'];
  loading:boolean = false;
  totalTransactions:number = 0

  async ngOnInit() {
    this.loading = true;
    let stats = await this.xummApi.getTransactionStatistics();

    if(stats) {
      console.log("received stats: " + JSON.stringify(stats));
      for(let trx in stats) {
        if (stats.hasOwnProperty(trx)) {

          let readableName = this.resolveTransactionName(trx);
          let readableStats = {
            name: readableName,
            number: stats[trx]
          };

          this.totalTransactions += stats[trx];
          this.statistics.push(readableStats);
        }
      }

      this.statistics.sort((trx1, trx2 ) => { return trx2.number - trx1.number });
      this.statistics.push({name: "Overall # of Trx", number: this.totalTransactions});
    }

    this.loading = false;
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
      default:                      return deliveredName;
    }
  }
}
