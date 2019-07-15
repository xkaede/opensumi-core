import { Injector } from '@ali/common-di';
import {
  createPreferenceProxy,
  PreferenceProxy,
  PreferenceService,
  PreferenceSchema,
} from '@ali/ide-core-browser';

export const workspacePreferenceSchema: PreferenceSchema = {
  type: 'object',
  properties: {
    'workspace.preserveWindow': {
      description: 'Enable opening workspaces in current window',
      type: 'boolean',
      default: false,
    },
    'workspace.supportMultiRootWorkspace': {
      description: 'Enable the multi-root workspace support to test this feature internally',
      type: 'boolean',
      default: false,
    },
  },
};

export interface WorkspaceConfiguration {
  'workspace.preserveWindow': boolean;
  'workspace.supportMultiRootWorkspace': boolean;
}

export const WorkspacePreferences = Symbol('WorkspacePreferences');
export type WorkspacePreferences = PreferenceProxy<WorkspaceConfiguration>;

export function createWorkspacePreferencesProvider(inject: Injector) {
  return {
    token: WorkspacePreferences,
    useFactory: () => {
      const preferences = inject.get(PreferenceService);
      return createPreferenceProxy(preferences, workspacePreferenceSchema);
    },
  };
}

export function injectWorkspacePreferences(inject: Injector) {
  inject.addProviders(createWorkspacePreferencesProvider(inject));
}
