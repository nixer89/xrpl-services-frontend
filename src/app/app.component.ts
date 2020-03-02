import { Component, OnInit } from '@angular/core';
import{ Router, NavigationEnd } from '@angular/router';

declare let gtag: Function;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'Xumm Community';

  constructor(private router: Router) {
    this.router.events.subscribe(event => {
      if(event instanceof NavigationEnd) {
          let path = (event.urlAfterRedirects.includes('?') ? event.urlAfterRedirects.substring(0, event.urlAfterRedirects.indexOf('?')) : event.urlAfterRedirects);
          gtag('config', 'UA-159404162-1', 
                {
                  'page_title': this.getPageTitle(path),
                  'page_path': path
                }
              );
       }
    });
  }

  getPageTitle(page_path:string): string {
    let title = "Xumm Community";

    switch(page_path) {
      case'': case '/': title = "XRPL Transactions"; break;
      case '/terms': title = "Xumm Community Terms"; break;
      case '/privacy': title = "Xumm Community Privacy"; break;
      default: title = "Xumm Community"; break;
    }

    return title;
  }

  ngOnInit(){
    // always scroll to the top of the page on route change:
    this.router.events.subscribe(e => e instanceof NavigationEnd ? window.scrollTo(0,0) : null);
  }

}
