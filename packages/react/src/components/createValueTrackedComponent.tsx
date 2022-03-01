import React, { createElement } from 'react';

import {
  attachProps,
  createForwardRef,
  dashToPascalCase,
  isCoveredByReact,
  mergeRefs,
} from './react-component-lib/utils';

export interface HTMLStencilElement extends HTMLElement {
  componentOnReady(): Promise<this>;
}

interface StencilReactInternalProps<ElementType> extends React.HTMLAttributes<ElementType> {
  forwardedRef: React.RefObject<ElementType>;
  ref?: React.Ref<any>;
}

export const createValueTrackedComponent = <
  PropType,
  ElementType extends HTMLStencilElement,
  ContextStateType = {},
  ExpandedPropsTypes = {}
>(
  tagName: string,
  ReactComponentContext?: React.Context<ContextStateType>,
  manipulatePropsFunction?: (
    originalProps: StencilReactInternalProps<ElementType>,
    propsToPass: any,
  ) => ExpandedPropsTypes,
  defineCustomElement?: () => void,
) => {
  if (defineCustomElement !== undefined) {
    defineCustomElement();
  }

  const displayName = dashToPascalCase(tagName);
  const ReactComponent = class extends React.Component<StencilReactInternalProps<ElementType>> {
    componentEl!: ElementType;

    setComponentElRef = (element: ElementType) => {
      this.componentEl = element;
    };

    updateValueIfChanged = (ev: any) => {
      const lastValue = (this.props as any).value;
      const nextValue = ev.detail.value;

      if (lastValue !== nextValue) {
        ev.preventDefault();
        queueMicrotask(() => this.setState({
          value: nextValue
        }));
        return true;
      }
      return false;
    }

    constructor(props: StencilReactInternalProps<ElementType>) {
      super(props);
    }

    componentDidMount() {
      this.componentDidUpdate(this.props);

      if (this.componentEl instanceof Element) {
        this.componentEl.addEventListener('ionInput', this.updateValueIfChanged);
      }
    }

    componentDidUpdate(prevProps: StencilReactInternalProps<ElementType>) {
      attachProps(this.componentEl, this.props, prevProps);
    }

    componentWillUnmount() {
      if (this.componentEl) {
        this.componentEl.removeEventListener('ionInput', this.updateValueIfChanged);
      }
    }

    render() {
      const { children, forwardedRef, style, className, ref, ...cProps } = this.props;

      let propsToPass = Object.keys(cProps).reduce((acc, name) => {
        if (name.indexOf('on') === 0 && name[2] === name[2].toUpperCase()) {
          const eventName = name.substring(2).toLowerCase();
          if (typeof document !== 'undefined' && isCoveredByReact(eventName)) {
            (acc as any)[name] = (cProps as any)[name];
          }
        } else {
          (acc as any)[name] = (cProps as any)[name];
        }
        return acc;
      }, {});

      if (manipulatePropsFunction) {
        propsToPass = manipulatePropsFunction(this.props, propsToPass);
      }

      const newProps: Omit<StencilReactInternalProps<ElementType>, 'forwardedRef'> = {
        ...propsToPass,
        ref: mergeRefs(forwardedRef, this.setComponentElRef),
        style,
      };

      /**
       * We use createElement here instead of
       * React.createElement to work around a
       * bug in Vite (https://github.com/vitejs/vite/issues/6104).
       * React.createElement causes all elements to be rendered
       * as <tagname> instead of the actual Web Component.
       */
      return createElement(tagName, newProps, children);
    }

    static get displayName() {
      return displayName;
    }
  };

  // If context was passed to createReactComponent then conditionally add it to the Component Class
  if (ReactComponentContext) {
    ReactComponent.contextType = ReactComponentContext;
  }

  return createForwardRef<PropType, ElementType>(ReactComponent, displayName);
};
