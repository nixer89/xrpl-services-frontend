import { Component, OnInit, ViewChild } from '@angular/core';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AppService } from '../../services/app.service';
import { IssuerVerification, Token, TokenIssuer } from '../../utils/types'
import * as normalizer from 'src/app/utils/normalizers';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { DeviceDetectorService } from 'ngx-device-detector';
import {animate, state, style, transition, trigger} from '@angular/animations';

@Component({
  selector: 'issuedTokenList',
  templateUrl: './issuedTokenList.html',
  styleUrls: ['./issuedTokenList.css'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({height: '0px', minHeight: '0'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ]
})
export class IssuedTokenList implements OnInit {

  constructor(
    private app: AppService,
    private deviceDetector: DeviceDetectorService,
    private googleAnalytics: GoogleAnalyticsService) {}

  @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;
  @ViewChild(MatSort, {static: true}) sort: MatSort;


  displayedColumns: string[] = ['account', 'username', 'currency', 'amount', 'trustlines', 'offers',  'link', 'explorer'];
  datasource:MatTableDataSource<TokenIssuer> = null;

  isExpansionDetailRow = (i: number, row: Object) => row.hasOwnProperty('detailRow');
  expandedElement: any;

  loading:boolean = false;

  pageSize:number = 25;
  filterText:string = "";
  
  ledgerIndex: string;
  ledgerHash: string;
  ledgerCloseTime: number;
  issuingAccounts: number = 0;
  accountNameTotal: number = 0;
  currencyCodeTotal: number = 0;
  issuedTokensTotal: number = 0;
  numberOfTrustlinesTotal: number = 0;
  dexOffersTotal: number = 0;
  uniqueFilteredAccount: Map<String, Number> = new Map<String, Number>();
  previousFilter: string;

  async ngOnInit() {
    this.pageSize = this.deviceDetector.isMobile() ? 5 : this.pageSize;
    this.loading = true;
    let issuers:TokenIssuer[] = await this.loadLedgerData();
    this.loading = false;
  
    this.datasource = new MatTableDataSource(issuers);

    if(issuers != null) {
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

      this.datasource.filterPredicate = (data: TokenIssuer, filter: string) => {
        if(filter)
          filter = filter.trim().toLowerCase()

        let matches:boolean =  data.account && data.account.toLowerCase().includes(filter)
                || data.amount && data.amount.toString().toLowerCase().includes(filter)
                  || data.currency && data.currency.toLowerCase().includes(filter)
                    || data.trustlines && data.trustlines.toString().toLowerCase().includes(filter)
                      || (data.username && data.username.toLowerCase().includes(filter));
        
        return matches;
      };

      this.googleAnalytics.analyticsEventEmitter('issuer_list_loaded', 'issuer_list', 'issuer_list_component');
    }
  }

  async loadLedgerData(): Promise<TokenIssuer[]> {
    let tokenIssuers:TokenIssuer[] = [];
    try {
      let position = 0;
      let issuedTokensResponse:any = await this.app.get('https://xrpldata.com/api/v1/tokens');

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
              twitter = data.twitter
            } else {
              username = "";
            }
            
            this.issuingAccounts++;

            issuedCurrencies.forEach(issuedCurrency => {
              position++;
              tokenIssuers.push({
                position: position,
                  account: account,
                  currency: this.getCurrencyCode(issuedCurrency.currency),
                  amount: issuedCurrency.amount,
                  trustlines: issuedCurrency.trustlines,
                  offers: issuedCurrency.offers,
                  username: username,
                  resolvedBy: resolvedBy,
                  verified: verified,
                  domain: domain,
                  twitter: twitter
                });

              this.uniqueFilteredAccount.set(account, 1);
              this.accountNameTotal += username ? 1 : 0;
              this.currencyCodeTotal += issuedCurrency.currency ? 1 : 0;
              this.issuedTokensTotal += issuedCurrency.amount ? Number(issuedCurrency.amount) : 0;
              this.dexOffersTotal += issuedCurrency.offers ? parseInt(issuedCurrency.offers) : 0;
              this.numberOfTrustlinesTotal += issuedCurrency.trustlines ? parseInt(issuedCurrency.trustlines) : 0;
            });
        }
      }
    } catch(err) {
      console.log(err)
      tokenIssuers = null
    }

    if(tokenIssuers && tokenIssuers.length == 0)
      tokenIssuers = null;

    return tokenIssuers;
  }

  stringToFloat(number: string): number {
    return parseFloat(number);
  }

  getCurrencyCode(currency: string): string {
    let normalizedCode = normalizer.normalizeCurrencyCodeXummImpl(currency);
    if(!normalizedCode || normalizedCode.trim().length == 0)
      return currency
    else
      return normalizedCode
  }

  applyFilter(event: Event) {
    this.filterText = (event.target as HTMLInputElement).value;
    this.datasource.filter = this.filterText.toLowerCase();

    //count totals
    this.uniqueFilteredAccount = new Map<String, Number>();
    this.dexOffersTotal = 0;
    this.accountNameTotal = 0;
    this.issuedTokensTotal = 0;
    this.currencyCodeTotal = 0;
    this.numberOfTrustlinesTotal = 0;
    this.previousFilter = null;
    //count everything!
    this.datasource.filteredData.forEach(data => {
        this.uniqueFilteredAccount.set(data.account, 1);
        this.accountNameTotal += data.username ? 1 : 0;
        this.currencyCodeTotal += data.currency ? 1 : 0;
        this.issuedTokensTotal += data.amount ? Number(data.amount) : 0;
        this.dexOffersTotal += data.offers ? parseInt(data.offers) : 0;
        this.numberOfTrustlinesTotal += data.trustlines ? parseInt(data.trustlines) : 0;
    });

    if (this.datasource.paginator) {
      this.datasource.paginator.firstPage();
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

  getTrustlineQueryParams(account: string, currency: string, limit: string): any {
    return { issuer: account , currency: currency , limit: limit};
  }
}
