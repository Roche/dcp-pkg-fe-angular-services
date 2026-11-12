import {AfterViewInit, ElementRef, Injectable, OnDestroy, Renderer2} from "@angular/core";

@Injectable()
export class RemoveHost implements AfterViewInit, OnDestroy {
  private movedNodes: Node[] = [];

  constructor(
    private readonly elRef: ElementRef,
    private readonly renderer: Renderer2
  ) {}


  ngAfterViewInit(): void {
    // access the DOM. get the element to unwrap
    const el = this.elRef.nativeElement;
    const parent = this.renderer.parentNode(this.elRef.nativeElement);

    // track nodes before moving them so they can be cleaned up on destroy
    this.movedNodes = Array.from(el.childNodes);

    // move all children out of the element
    while (el.firstChild) { // this line doesn't work with server-rendering
      this.renderer.appendChild(parent, el.firstChild);
    }

    // remove the empty element from the parent
    this.renderer.removeChild(parent, el);
  }

  ngOnDestroy(): void {
    this.movedNodes.forEach((node) => {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
    this.movedNodes = [];
  }
}
