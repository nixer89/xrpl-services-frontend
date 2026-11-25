import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
    name: 'highlightSearch',
    standalone: false
})
  export class HighlightSearchPipe implements PipeTransform {
  
    transform(value: string, search: string): string {
      try {
        // the result is bound to [innerHTML] and the values come from the ledger / external APIs -> never pass them on as HTML
        const valueStr = this.escapeHtml(value + ''); // Ensure numeric values are converted to strings

        if(search === '')
          return valueStr;

        // search for the text as typed (escaped the same way as the value), not as a regular expression
        search = this.escapeHtml(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return valueStr.replace(new RegExp('(?![^&;]+;)(?!<[^<>]*)(' + search + ')(?![^<>]*>)(?![^&;]+;)', 'gi'), '<strong class="warning">$1</strong>');
      } catch(err) {
        console.log(err);
        console.log("error on value: " + value + " and search: " + search);
        return "";
      }
    }

    private escapeHtml(text: string): string {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
  }