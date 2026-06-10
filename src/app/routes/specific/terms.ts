import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Component({
    selector: 'terms',
    templateUrl: 'terms.html',
    standalone: false
})

export class TermsComponent implements OnInit {

  constructor(private titleService: Title) {}

  ngOnInit() {
    this.titleService.setTitle("XRPL Services Terms");
  }
}
