import { Component, OnInit, ViewChild } from '@angular/core';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AppService } from '../../services/app.service';
import { IssuerVerification, Token, NftIssuer } from '../../utils/types'
import * as normalizer from 'src/app/utils/normalizers';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { DeviceDetectorService } from 'ngx-device-detector';
import {animate, state, style, transition, trigger} from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { TokenDetailsDialog } from './tokenDetailsDialog';
import { XummService } from 'src/app/services/xumm.service';

@Component({
  selector: 'issuedNftList',
  templateUrl: './issuedNftList.html',
  styleUrls: ['./issuedNftList.css'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({height: '0px', minHeight: '0'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ]
})
export class IssuedNftList implements OnInit {

  constructor(
    private app: AppService,
    private xummBackend: XummService,
    private deviceDetector: DeviceDetectorService,
    private matDialog: MatDialog,
    private googleAnalytics: GoogleAnalyticsService) {}

  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;
  @ViewChild(MatSort, {static: true}) sort: MatSort;

  sortColumns: string[] = ['account', 'kyc', 'username', 'currency', 'amount', 'trustlines', 'holders', 'offers'];
  
  displayedColumns: string[] = ['account', 'kyc', 'username', 'currency', 'amount', 'trustlines', 'holders', 'offers',  'trustlinelink', 'dexlink', 'explorer'];
  datasource:MatTableDataSource<NftIssuer> = null;

  allTokens: NftIssuer[] = null;
  kycTokensOnly: NftIssuer[] = null;

  showKycOnly:boolean = false;

  loading:boolean = false;

  pageSize:number = 25;
  filterText:string = "";
  
  ledgerIndex: string;
  ledgerHash: string;
  ledgerCloseTime: number;
  issuingAccounts: number = 0;
  numberOfIssuedTokens: number = 0;

  accountNameTotal: number = 0;
  currencyCodeTotal: number = 0;
  issuedTokensTotal: number = 0;
  numberOfTrustlinesTotal: number = 0;
  numberOfHoldersTotal: number = 0;
  dexOffersTotal: number = 0;
  kycAccountsTotal: number = 0;
  uniqueFilteredAccount: Map<String, Number> = new Map<String, Number>();
  previousFilter: string;

  hotToken1D:any[];
  hotToken1W:any[];
  hotToken1M:any[];

  errorMessage:string = "Could not load XRP Ledger NFTs. Please try again later!";

  async ngOnInit() {
    this.pageSize = this.deviceDetector.isMobile() ? 5 : this.pageSize;
    this.loading = true;

    try {
      let promises:any[] = [];
      promises.push(this.loadLedgerData());
      promises.push(this.xummBackend.getHottestToken1D());
      //promises.push(this.xummBackend.getHottestToken1W());
      //promises.push(this.xummBackend.getHottestToken1M());

      let results = await Promise.all(promises);

      this.allTokens = results[0];
      
      this.hotToken1D = results[1];
      //console.log(JSON.stringify(this.hotToken1D));
      //this.hotToken1W = results[2];
      //this.hotToken1M = results[3];
    } catch(err) {
      console.log(JSON.stringify(err));
      this.allTokens = null;
    }
    
  
    if(this.allTokens != null) {
      this.datasource = new MatTableDataSource(this.allTokens);

      if(this.allTokens != null) {

        for(let i = 0; i < 10; i++) {
          this.allTokens.find(issuer => {
            if(this.hotToken1D && this.hotToken1D.length >= 10 && this.hotToken1D[i]['_id'].issuer === issuer.account && this.hotToken1D[i]['_id'].currency === normalizer.getCurrencyCodeForXRPL(issuer.currencyCode)) {
              issuer.isHot = true;
              issuer.newTrustlines = this.hotToken1D[i].count;
              //console.log(issuer.account + " is hot!");
            }
          })
        }

        this.datasource.paginator = this.paginator;
        this.datasource.sort = this.sort;

        this.datasource.sortingDataAccessor = (data: any, sortHeaderId: string): string => {
          if (typeof data[sortHeaderId] === 'string') {
            if(!data[sortHeaderId] || data[sortHeaderId].trim().length == 0) {
              if(this.sort.direction === 'asc')
                return "zzzzzzzzzzzzzzzzzzzzzzzzz"
              else
                return "0000000000000000000000000"
            }
            else
              return data[sortHeaderId].toLocaleLowerCase();
          }
        
          return data[sortHeaderId];
        };

        this.datasource.filterPredicate = (data: NftIssuer, filter: string) => {
          if(filter)
            filter = filter.trim().toLowerCase()

          let matches:boolean =  data.account && data.account.toLowerCase().includes(filter)
                  || data.shownAmount && data.shownAmount.toString().toLowerCase().includes(filter)
                    || data.currencyCodeUTF8 && data.currencyCodeUTF8.toLowerCase().includes(filter)
                      || data.trustlines && data.trustlines.toString().toLowerCase().includes(filter)
                        || data.holders && data.holders.toString().toLowerCase().includes(filter)
                          || (data.username && data.username.toLowerCase().includes(filter))
                            || (data.currencyCode && data.currencyCode.includes(filter) && filter.length == 40 && normalizer.isHex(filter));
          
          return matches;
        };

        if(this.datasource && this.datasource.data) {
          this.numberOfIssuedTokens = this.datasource.data.length;
        }

        this.googleAnalytics.analyticsEventEmitter('issuer_list_loaded', 'issuer_list', 'issuer_list_component');

        this.kycTokensOnly = this.allTokens.filter(token => token.kyc);
      }
    }

    this.loading = false;

    //console.log("Hottest token 1D: " + JSON.stringify(this.hotToken1D));
    //console.log("Hottest token 1W: " + JSON.stringify(this.hotToken1W));
    //console.log("Hottest token 1M: " + JSON.stringify(this.hotToken1M));
  }

  async loadLedgerData(): Promise<NftIssuer[]> {

    let tokenIssuers:NftIssuer[] = [];
    try {
      let issuedTokensResponse:any = await this.app.get('https://api.xrpldata.com/api/v1/nfts');

      this.ledgerIndex = issuedTokensResponse.ledger_index;
      this.ledgerHash = issuedTokensResponse.ledger_hash;
      this.ledgerCloseTime = issuedTokensResponse.ledger_close_ms;
      this.issuingAccounts = 0;

      let issuers:any = issuedTokensResponse.issuers ? issuedTokensResponse.issuers : issuedTokensResponse.tokens;

      for (var account in issuers) {

        if (issuers.hasOwnProperty(account)) {
            let issuedCurrencies:Token[] = issuers[account].tokens;
            let data:IssuerVerification = issuers[account].data;
            let resolvedBy,username,domain,twitter:string = "";
            let verified:boolean = false;

            if(data && account == data.account) {
              resolvedBy = data.resolvedBy;
              verified = data.verified;
              username = data.username ? data.username : "";
              domain = data.domain;
              twitter = data.twitter;
            } else {
              username = "";
            }
            
            this.issuingAccounts++;

            issuedCurrencies.forEach(issuedCurrency => {

              let normalizedAmount = normalizer.XRPLValueToNFT(Number(issuedCurrency.amount));

              let nftValueToShow:number = (normalizedAmount && typeof normalizedAmount === 'number') ? normalizedAmount : 0;

              tokenIssuers.push({
                  account: account,
                  currencyCode: issuedCurrency.currency,
                  currencyCodeUTF8: normalizer.normalizeCurrencyCodeXummImpl(issuedCurrency.currency),
                  amount: issuedCurrency.amount,
                  shownAmount: nftValueToShow,
                  trustlines: issuedCurrency.trustlines,
                  holders: issuedCurrency.holders,
                  offers: issuedCurrency.offers,
                  username: username,
                  resolvedBy: resolvedBy,
                  verified: verified,
                  domain: domain,
                  twitter: twitter,
                  kyc: data.kyc,
                  created: issuedCurrency.created
                });

              this.uniqueFilteredAccount.set(account, 1);
              this.accountNameTotal += username ? 1 : 0;
              this.currencyCodeTotal += issuedCurrency.currency ? 1 : 0;
              this.issuedTokensTotal += nftValueToShow;
              this.dexOffersTotal += issuedCurrency.offers ? issuedCurrency.offers : 0;
              this.numberOfTrustlinesTotal += issuedCurrency.trustlines ? issuedCurrency.trustlines : 0;
              this.numberOfHoldersTotal += issuedCurrency.holders ? issuedCurrency.holders : 0;
              this.kycAccountsTotal += data.kyc ? 1 : 0;
            });
        }
      }
    } catch(err) {
      console.log(err)

      if(err && (typeof err === 'string')) {
        //console.log("setting message: " + err)
        this.errorMessage = err;
      }
      
      tokenIssuers = null
    }

    if(tokenIssuers && tokenIssuers.length == 0)
      tokenIssuers = null;

    return tokenIssuers;
  }

  stringToFloat(number: string): number {
    return parseFloat(number);
  }

  applyFilter(event: Event) {
    if(this.datasource && this.datasource.data) {
      this.filterText = (event.target as HTMLInputElement).value;
      this.datasource.filter = this.filterText.toLowerCase();

      //count totals
      this.uniqueFilteredAccount = new Map<String, Number>();
      this.dexOffersTotal = 0;
      this.accountNameTotal = 0;
      this.issuedTokensTotal = 0;
      this.currencyCodeTotal = 0;
      this.numberOfTrustlinesTotal = 0;
      this.numberOfHoldersTotal = 0;
      this.previousFilter = null;
      //count everything!
      this.datasource.filteredData.forEach(data => {
          this.uniqueFilteredAccount.set(data.account, 1);
          this.accountNameTotal += data.username ? 1 : 0;
          this.currencyCodeTotal += data.currencyCode ? 1 : 0;
          this.issuedTokensTotal += data.shownAmount ? data.shownAmount : 0;
          this.dexOffersTotal += data.offers ? data.offers : 0;
          this.numberOfTrustlinesTotal += data.trustlines ? data.trustlines : 0;
          this.numberOfHoldersTotal += data.holders ? data.holders : 0;
      });

      if (this.datasource.paginator) {
        this.datasource.paginator.firstPage();
      }
    }
  }

  humanReadableCloseTime(): string {
    if(this.ledgerCloseTime != null && this.ledgerCloseTime > 0)
      return new Date(normalizer.rippleEpocheTimeToUTC(this.ledgerCloseTime)).toLocaleString();
    else
      return "";
  }

  getBithompLink(account:string): string {
    return "https://bithomp.com/explorer/"+account;
  }

  getXRPScanLink(account:string): string {
    return "https://xrpscan.com/account/"+account;
  }

  getDexLink(issuer:string, currency:string) {
    return "https://xumm.app/detect/xapp:xumm.dex?issuer="+issuer+"&currency="+currency;
  }

  getTrustlineQueryParams(tokenIssuer:NftIssuer): any {
    return { issuer: tokenIssuer.account , currency: tokenIssuer.currencyCode , limit: tokenIssuer.amount};
  }

  openDetailsDialog(tokenIssuer:NftIssuer): void {
    this.matDialog.open(TokenDetailsDialog, {
      width: 'auto',
      height: 'auto;',
      data: tokenIssuer
    });
  }

  switchTokenList() {
    if(this.datasource && this.datasource.data) {
      if(this.showKycOnly)
        this.datasource.data = this.kycTokensOnly
      else
        this.datasource.data = this.allTokens;
    }
  }
}
