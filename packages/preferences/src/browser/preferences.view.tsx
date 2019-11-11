import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { replaceLocalizePlaceholder, useInjectable, PreferenceSchemaProvider, PreferenceDataProperty, URI, CommandService, localize, PreferenceSchemaProperty, PreferenceScope, EDITOR_COMMANDS, IFileServiceClient } from '@ali/ide-core-browser';
import { PreferenceSettingsService } from './preference.service';
import Tabs from 'antd/lib/tabs';
import './index.less';
import * as styles from './preferences.module.less';
import * as classnames from 'classnames';
import { Scroll } from '@ali/ide-editor/lib/browser/component/scroll/scroll';
import { ISettingGroup, IPreferenceSettingsService, ISettingSection } from '@ali/ide-core-browser';
import throttle = require('lodash.throttle');
import { IWorkspaceService } from '@ali/ide-workspace';
import * as cls from 'classnames';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import uniqBy = require('lodash.uniqBy');

export const PreferenceView: ReactEditorComponent<null> = observer((props) => {

  const preferenceService: PreferenceSettingsService  = useInjectable(IPreferenceSettingsService);

  const [currentScope, setCurrentScope] = React.useState(PreferenceScope.User);

  const groups = preferenceService.getSettingGroups().filter((g) => preferenceService.getSections(g.id, currentScope).length > 0);
  const [currentGroup, setCurrentGroup] = React.useState(groups[0] ? groups[0].id : '');

  if (groups.findIndex( (g) => g.id === currentGroup) === -1) {
    setCurrentGroup(groups[0].id);
  }

  return (
    <div className = {styles.preferences}>
      <div className = {styles.preferences_header}>
        <div className = {classnames({[styles.activated]: currentScope === PreferenceScope.User })} onClick={() => setCurrentScope(PreferenceScope.User )}>{localize('preference.tab.user', '全局设置')}</div>
        <div className = {classnames({[styles.activated]: currentScope === PreferenceScope.Workspace })} onClick={() => setCurrentScope(PreferenceScope.Workspace)}>{localize('preference.tab.workspace', '工作区设置')}</div>
      </div>
      <div className = {styles.preferences_body}>
        <PreferencesIndexes groups={groups} currentGroupId={currentGroup} setCurrentGroup={setCurrentGroup} scope={currentScope}></PreferencesIndexes>
        <div className = {styles.preferences_items}>
          <PreferenceBody groupId={currentGroup} scope={currentScope}></PreferenceBody>
        </div>
      </div>
    </div>
  );
});

export const PreferenceSections = (({preferenceSections}: {preferenceSections: ISettingSection[]}) => {

  preferenceSections = uniqBy(preferenceSections, (section) => {
    return section.title;
  });

  return <div className={styles.preference_section_link}>{
    preferenceSections.map((section, idx) => {
      return <div key={`${section.title}-${idx}`}><a href={`#${section.title}`} >{section.title}</a></div>;
    })
  }</div>;
});

export const PreferencesIndexes = ({groups, currentGroupId: currentGroup, setCurrentGroup, scope}: {groups: ISettingGroup[] , currentGroupId: string, setCurrentGroup: (groupId) => void, scope: PreferenceScope }) => {
  const preferenceService: PreferenceSettingsService  = useInjectable(IPreferenceSettingsService);

  return <div className = {styles.preferences_indexes}>
    <Scroll>
      {
        groups && groups.map(({id, title, iconClass}) => {

          const sections = preferenceService.getSections(id, scope);

          return (<div>
            <div key={`${id} - ${title}`} className={classnames({
              [styles.index_item]: true,
              [styles.activated]: currentGroup === id,
            })} onClick={() => {setCurrentGroup(id); }}>
            <span className={iconClass}></span>
            {replaceLocalizePlaceholder(title)}
            </div>
            {
              currentGroup === id ?
              <div>
                <PreferenceSections preferenceSections={sections}></PreferenceSections>
              </div>
              : <div></div>
            }
          </div>);
        })
      }
    </Scroll>
  </div>;
};

export const PreferenceBody = ({groupId, scope}: {groupId: string, scope: PreferenceScope}) => {
  const preferenceService: PreferenceSettingsService  = useInjectable(IPreferenceSettingsService);

  return <Scroll>
    {preferenceService.getSections(groupId, scope).map((section, idx) => {
      return <PreferenceSection key={`${section} - ${idx}`} section={section} scope={scope} />;
    }) || <div></div>}
  </Scroll>;
};

export const PreferenceSection = ({section, scope}: {section: ISettingSection, scope: PreferenceScope}) => {
  return <div className={styles.preference_section} id={section.title}>
    {
      section.title ? <div className={styles.section_title}>{section.title}</div> : null
    }
    {
      section.component ? <section.component scope={scope}/> :
      section.preferences.map((preference, idx) => {
        if (typeof preference === 'string') {
          return <PreferenceItemView key={`${idx} - ${preference}`} preferenceName={preference} scope={scope} />;
        } else {
          return <PreferenceItemView key={`${idx} - ${preference.id}`} preferenceName={preference.id} localizedName={localize(preference.localized)} scope={scope} />;
        }
      }) || <div></div>
    }
  </div>;
};

export const PreferenceItemView = ({preferenceName, localizedName, scope}: {preferenceName: string, localizedName?: string, scope: PreferenceScope}) => {

  const preferenceService: PreferenceSettingsService  = useInjectable(IPreferenceSettingsService);
  const defaultPreferenceProvider: PreferenceSchemaProvider = useInjectable(PreferenceSchemaProvider);

  const commandService = useInjectable(CommandService);
  const fileServiceClient = useInjectable(IFileServiceClient);
  const workspaceService: IWorkspaceService = useInjectable(IWorkspaceService);

  const key = preferenceName;
  const prop: PreferenceDataProperty|undefined = defaultPreferenceProvider.getPreferenceProperty(key);

  if (!localizedName) {
    localizedName = toPreferenceReadableName(preferenceName);
  }

  const [value, setValue] = React.useState(preferenceService.getPreference(preferenceName, scope).value);

  const changeValue = (key, value) => {
    doChangeValue(value);
    setValue(value);
  };

  React.useEffect(() => {
    setValue(preferenceService.getPreference(preferenceName, scope).value);
  }, [scope, preferenceName]);

  const doChangeValue = throttle((value) => {
    preferenceService.setPreference(key, value, scope);
  }, 500, {trailing: true});

  const renderPreferenceItem = () => {
    if (prop) {
      switch (prop.type) {
        case 'boolean':
          return renderBooleanValue();
        case 'integer':
        case 'number':
          return renderNumberValue();
        case 'string':
          if (prop.enum) {
            return renderEnumsValue();
          } else {
            return renderTextValue();
          }
        case 'array':
          if (prop.items && prop.items.type === 'string') {
            return renderArrayValue();
          } else {
            return renderOtherValue();
          }
        default:
          return renderOtherValue();
      }
    }
    return <div></div>;
  };

  const renderBooleanValue = () => {

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <select onChange={(event) => {
              changeValue(key, event.target.value === 'true');
            }}
            className={styles.select_control}
            value={value ? 'true' : 'false'}
          >
            <option key='true' value='true'>true</option>
            <option key='value' value='false'>false</option>
          </select>
        </div>
      </div>
    );
  };

  const renderNumberValue = () => {

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <input
            type='number'
            className={styles.number_control}
            onChange={(event) => {
              changeValue(key, parseInt(event.target.value, 10));
            }}
            value={value}
          />
        </div>
      </div>
    );
  };

  const renderTextValue = () => {

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <input
            type='text'
            className={styles.text_control}
            onChange={(event) => {
              changeValue(key, event.target.value);
            }}
            value={value || ''}
          />
        </div>
      </div>
    );
  };

  const renderEnumsValue = () => {

    if (!prop) {
      return <div></div>;
    }

    const optionEnum = (prop as PreferenceDataProperty).enum;

    if (!Array.isArray(optionEnum) || !optionEnum.length) {
      return <div></div>;
    }

    // enum 本身为 string[] | number[]
    const labels = preferenceService.getEnumLabels(preferenceName);
    const options = optionEnum && optionEnum.map((item, idx) =>
      <option value={item} key={`${idx} - ${item}`}>{
        replaceLocalizePlaceholder((labels[item] || item).toString())
      }</option>);

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <select onChange={(event) => {
              changeValue(key, event.target.value);
            }}
            className={styles.select_control}
            value={value}
          >
            {options}
          </select>
        </div>
      </div>
    );
  };

  const renderArrayValue = () => {

    let editEl;
    const addItem = () => {
      if (editEl.value) {
        const newValue = value.slice(0);
        newValue.push(editEl.value);
        editEl.value = '';
        changeValue(key, newValue);
      }
    };
    const removeItem = (idx) => {
      const newValue = value.slice(0);
      newValue.splice(idx, 1);
      if (newValue.length) {
        changeValue(key, newValue);
      } else {
        changeValue(key, []);
      }
    };

    const items: any[] = [];
    value.map((item, idx) => {
      items.push(
      <li className={styles.arr_items} key={`${idx} - ${JSON.stringify(item)}`}>
        <div onClick={() => { removeItem(idx); }} className={cls(getIcon('delete'), styles.rm_icon, styles.arr_item)}></div>
        <div className={styles.arr_item}>{JSON.stringify(item)}</div>
      </li>);
    });

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <ul className={styles.arr_list}>
            {items}
          </ul>
          <input
            type='text'
            className={styles.text_control}
            ref={(el) => { editEl = el; }}
          />
          <input className={styles.add_button} onClick={addItem} type='button' value={localize('preference.array.additem', '添加')} />
        </div>
      </div>
    );
  };

  const renderOtherValue = () => {

    return (
      <div className={styles.preference_line} key={key}>
        <div className={styles.key}>
          {localizedName}
        </div>
        {prop && prop.description && <div className={styles.desc}>{replaceLocalizePlaceholder(prop.description)}</div>}
        <div className={styles.control_wrap}>
          <a href='#' onClick={editSettingsJson}>Edit in settings.json</a>
        </div>
      </div>
    );
  };
  const editSettingsJson = () => {

    const doOpen = (uri) => {
      fileServiceClient.exists(uri).then((exist) => {
        if (exist) {
          commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI(uri));
        } else {
          fileServiceClient.createFile(uri, {content: '', overwrite: false}).then((fstat) => {
            commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI(uri));
          }).catch((e) => {
            console.log('create settings.json faild!', e);
          });
        }

      });
    };

    if (scope === PreferenceScope.User) {
      fileServiceClient.getCurrentUserHome().then((dir) => {
        if (dir) {
          doOpen(dir.uri + '/.kaitian/settings.json');
        }
      });
    } else {
      workspaceService.roots.then( (dirs) => {
        const dir = dirs[0];
        if (dir) {
          doOpen(dir.uri + '/.kaitian/settings.json');
        }
      });
    }
  };

  return <div>
    {renderPreferenceItem()}
  </div>;

};

function toPreferenceReadableName(name) {
  const parts = name.split('.');
  let result = toNormalCase(parts[0]);
  if (parts[1]) {
    result += ' > ' + toNormalCase(parts[1]);
  }
  if (parts[2]) {
    result += ' : ' + toNormalCase(parts[2]);
  }
  return result;
}

function toNormalCase(str: string) {
  return str.substr(0, 1).toUpperCase() + str.substr(1).replace(/([^A-Z])([A-Z])/g, '$1 $2');
}
