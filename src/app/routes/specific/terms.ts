import { Component, OnInit } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';

@Component({
  selector: 'terms',
  templateUrl: 'terms.html'
})

export class TermsComponent implements OnInit {

  constructor(private titleService: Title, private meta: Meta) {}

  ngOnInit() {
    this.titleService.setTitle("Xumm Community Terms");
  }
}
