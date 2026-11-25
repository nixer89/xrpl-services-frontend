import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { XummService } from '../services/xumm.service';

interface StatisticsRow {
  name: string;
  number: number;
  share: number; // percent of the section total, 0-100
}

interface StatisticsSection {
  title: string;
  icon: string;
  description: string;
  since: string;
  total: number;
  rows: StatisticsRow[];
  showEscrowInfo?: boolean;
}

@Component({
    selector: 'statistics',
    templateUrl: './statistics.html',
    styleUrls: ['./statistics.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
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


    // a single failing request must not block the whole page: treat it as "no data" for that section
    let results = await Promise.all(promises.map(promise => Promise.resolve(promise).catch(() => null)));

    let statsWeb = results[0];
    let statsEscrow = results[1];
    let statsToken = results[2];
    this.escrowNextRelease = results[3] != null ? new Date(results[3]) : null;
    this.escrowLastRelease = results[4] != null ? new Date(results[4]) : null;
    this.escrowCurrentCount = results[5];
    let statsNFT = results[6];
    let statsTrasher = results[7];

    this.totalTransactionsWeb = this.calculateStats(statsWeb, this.statisticsWeb, this.totalTransactionsWeb);
    this.totalTransactionsEscrow = this.calculateStats(statsEscrow, this.statisticsEscrow, this.totalTransactionsEscrow);
    this.totalTransactionsToken = this.calculateStats(statsToken, this.statisticsToken, this.totalTransactionsToken);
    this.totalTransactionsNFT = this.calculateStats(statsNFT, this.statisticsNFT, this.totalTransactionsNFT);
    this.totalTransactionsTokenTrasher = this.calculateStats(statsTrasher, this.statisticsTokenTrasher, this.totalTransactionsTokenTrasher);

    this.sections = [
      this.buildSection('Xrpl.Services Website', 'language', 'Transactions executed through this website', 'March 23rd 2021', this.statisticsWeb, this.totalTransactionsWeb),
      this.buildSection('Token Trasher xApp', 'delete_sweep', "Transactions executed through the xApp 'Token Trasher'", 'February 15th 2022', this.statisticsTokenTrasher, this.totalTransactionsTokenTrasher),
      this.buildSection('Token Creator xApp', 'toll', "Transactions executed through the xApp 'Token creator'", 'April 21st 2021', this.statisticsToken, this.totalTransactionsToken),
      { ...this.buildSection('Escrow Creator xApp', 'lock_clock', "Transactions executed through the xApp 'Escrow creator'", 'April 21st 2021', this.statisticsEscrow, this.totalTransactionsEscrow), showEscrowInfo: true },
      this.buildSection('NFT Creator xApp', 'image', "Transactions executed through the xApp 'NFT creator'", 'July 10th 2021', this.statisticsNFT, this.totalTransactionsNFT),
    ];

    this.grandTotal = this.sections.reduce((sum, section) => sum + (section.total || 0), 0);

    this.loading = false;
  }

  sections: StatisticsSection[] = [];
  grandTotal: number = 0;

  private buildSection(title: string, icon: string, description: string, since: string, stats: any[], total: number): StatisticsSection {
    const rows: StatisticsRow[] = (stats || [])
      .filter(stat => !String(stat.name).startsWith('Overall'))
      .map(stat => ({
        name: stat.name,
        number: stat.number,
        share: total > 0 ? (stat.number / total) * 100 : 0
      }));

    return { title, icon, description, since, total, rows };
  }

  get hasEscrowInfo(): boolean {
    return !!(this.escrowNextRelease && this.escrowLastRelease && this.escrowCurrentCount);
  }

  calculateStats(apiResult: any, statsArray: any[], totalTransaction: number): number {
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

    return totalTransaction;
  }

  resolveTransactionName(deliveredName: string) {
    switch(deliveredName.toLowerCase()) {
      case "signin":                return "Sign In";
      case "accountset":            return "Account Set";
      case "accountdelete":         return "Account Delete";
      case "checkcancel":           return "Check Cancel";
      case "checkcash":             return "Check Cash";
      case "checkcreate":           return "Check Create";
      case "depositpreauth":        return "Deposit Preauth";
      case "escrowcancel":          return "Escrow Cancel";
      case "escrowcreate":          return "Escrow Create";
      case "escrowfinish":          return "Escrow Finish";
      case "offercancel":           return "Offer Cancel";
      case "offercreate":           return "Offer Create";
      case "payment":               return "Payment";
      case "paymentchannelclaim":   return "Paymentchannel Claim";
      case "paymentchannelcreate":  return "Paymentchannel Create";
      case "paymentchannelfund":    return "Paymentchannel Fund";
      case "setregularkey":         return "Set Regular Key";
      case "signerlistset":         return "Set Signer List";
      case "ticketcreate":          return "Ticket Create";
      case "trustset":              return "Trust Set";
      case "nftokenacceptoffer":    return "NFToken Accept Offer";
      case "nftokenburn":           return "NFToken Burn";
      case "nftokencanceloffer":    return "NFToken Cancel Offer";
      case "nftokencreateoffer":    return "NFToken Create Offer";
      case "nftokenmint":           return "NFToken Mint";
      default:                      return deliveredName;
    }
  }
}
