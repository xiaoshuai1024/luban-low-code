import type { Component } from 'vue';
import {
  LubanButton,
  LubanContainer,
  LubanRow,
  LubanCol,
  LubanBanner,
  LubanText,
  LubanForm,
  LubanInput,
  LubanTextArea,
  LubanSelect,
  LubanCheckbox,
  LubanRadioGroup,
  LubanSwitch,
} from 'luban-base';

const registry: Record<string, Component> = {
  LubanButton,
  LubanContainer,
  LubanRow,
  LubanCol,
  LubanBanner,
  LubanText,
  LubanForm,
  LubanInput,
  LubanTextArea,
  LubanSelect,
  LubanCheckbox,
  LubanRadioGroup,
  LubanSwitch,
};

export function getComponent(type: string): Component | undefined {
  return registry[type];
}

export function registerComponent(type: string, component: Component): void {
  registry[type] = component;
}
