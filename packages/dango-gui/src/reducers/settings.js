const UPDATE = 'scratch-gui/settings/UPDATE';
const NEW_ITEM = 'scratch-gui/settings/NEW_ITEM';
const RESET_DEFAULT = 'scratch-gui/settings/RESET_DEFAULT';

const defaultState = {
    framerate: 30,
    compiler: true,
    warpTimer: true,
    hqpen: false,
    hideNonOriginalBlocks: false,
    infiniteCloning: false,
    removeFencing: false,
    miscLimits: false,
    saveSettings: false,
    saveExtension: true,
    colorPalette: 'scratch', // 'scratch' or 'material'
    themeColor: '#4c97ff',
    darkMode: 'system'
};

const initialState = JSON.parse(localStorage.getItem('settings')) || {};
let needUpdate = false;
for (const key in defaultState) {
    if (!initialState.hasOwnProperty(key)) {
        initialState[key] = defaultState[key];
        needUpdate = true;
    }
}
if (needUpdate) localStorage.setItem('settings', JSON.stringify(initialState));

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case UPDATE:
        state[action.key] = action.value;
        localStorage.setItem('settings', JSON.stringify(state));
        return Object.assign({}, state);
    case NEW_ITEM:
        if (state.hasOwnProperty(action.key)) {
            // if the setting item already exists
            return state;
        }
        state[action.key] = action.defaultValue;
        localStorage.setItem('settings', JSON.stringify(state));
        return Object.assign({}, state);
    case RESET_DEFAULT:
        localStorage.setItem('settings', JSON.stringify(defaultState));
        return Object.assign({}, defaultState);
    default:
        return state;
    }
};

const updateSetting = (key, value) => ({
    type: UPDATE,
    key,
    value
});

const addNewSetting = (key, defaultValue) => ({
    type: NEW_ITEM,
    key,
    defaultValue
});

const resetSettingsToDefault = () => ({
    type: RESET_DEFAULT
});

export {
    reducer as default,
    initialState as settingsInitialState,
    updateSetting,
    addNewSetting,
    resetSettingsToDefault
};
