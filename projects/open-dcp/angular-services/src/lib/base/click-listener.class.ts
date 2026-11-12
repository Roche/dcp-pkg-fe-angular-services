import {HostListener, Injectable, Input} from "@angular/core";

@Injectable()
export class ClickListener {
  @Input() disabled: boolean = false;
  @HostListener("click", ['$event']) onClick(event: MouseEvent){
    if (this.disabled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
}
