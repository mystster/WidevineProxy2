import "../protobuf.min.js";
import "../license_protocol.js";
import {AsyncLocalStorage, base64toUint8Array, stringToUint8Array, DeviceManager, RemoteCDMManager, SettingsManager} from "../util.js";

const key_container = document.getElementById('key-container');

// ================ Main ================
const enabled = document.getElementById('enabled');
enabled.addEventListener('change', async function (){
    await SettingsManager.setEnabled(enabled.checked);
});

const toggle = document.getElementById('darkModeToggle');
toggle.addEventListener('change', async () => {
    await SettingsManager.setDarkMode(toggle.checked);
    await SettingsManager.saveDarkMode(toggle.checked);
});

const wvd_select = document.getElementById('wvd_select');
wvd_select.addEventListener('change', async function (){
    if (wvd_select.checked) {
        await SettingsManager.saveSelectedDeviceType("WVD");
    }
});

const remote_select = document.getElementById('remote_select');
remote_select.addEventListener('change', async function (){
    if (remote_select.checked) {
        await SettingsManager.saveSelectedDeviceType("REMOTE");
    }
});

const export_button = document.getElementById('export');
export_button.addEventListener('click', async function() {
    const logs = await AsyncLocalStorage.getStorage(null);
    SettingsManager.downloadFile(stringToUint8Array(JSON.stringify(logs)), "logs.json");
});
// ======================================

// ================ Widevine Device ================
document.getElementById('fileInput').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: "OPEN_PICKER_WVD" });
    window.close();
});

const remove = document.getElementById('remove');
remove.addEventListener('click', async function() {
    await DeviceManager.removeSelectedWidevineDevice();
    wvd_combobox.innerHTML = '';
    await DeviceManager.loadSetAllWidevineDevices();
    const selected_option = wvd_combobox.options[wvd_combobox.selectedIndex];
    if (selected_option) {
        await DeviceManager.saveSelectedWidevineDevice(selected_option.text);
    } else {
        await DeviceManager.removeSelectedWidevineDeviceKey();
    }
});

const download = document.getElementById('download');
download.addEventListener('click', async function() {
    const widevine_device = await DeviceManager.getSelectedWidevineDevice();
    SettingsManager.downloadFile(
        base64toUint8Array(await DeviceManager.loadWidevineDevice(widevine_device)),
        widevine_device + ".wvd"
    )
});

const wvd_combobox = document.getElementById('wvd-combobox');
wvd_combobox.addEventListener('change', async function() {
    await DeviceManager.saveSelectedWidevineDevice(wvd_combobox.options[wvd_combobox.selectedIndex].text);
});
// =================================================

// ================ Remote CDM ================
document.getElementById('remoteInput').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: "OPEN_PICKER_REMOTE" });
    window.close();
});

const remote_remove = document.getElementById('remoteRemove');
remote_remove.addEventListener('click', async function() {
    await RemoteCDMManager.removeSelectedRemoteCDM();
    remote_combobox.innerHTML = '';
    await RemoteCDMManager.loadSetAllRemoteCDMs();
    const selected_option = remote_combobox.options[remote_combobox.selectedIndex];
    if (selected_option) {
        await RemoteCDMManager.saveSelectedRemoteCDM(selected_option.text);
    } else {
        await RemoteCDMManager.removeSelectedRemoteCDMKey();
    }
});

const remote_download = document.getElementById('remoteDownload');
remote_download.addEventListener('click', async function() {
    const remote_cdm = await RemoteCDMManager.getSelectedRemoteCDM();
    SettingsManager.downloadFile(
        await RemoteCDMManager.loadRemoteCDM(remote_cdm),
        remote_cdm + ".json"
    )
});

const remote_combobox = document.getElementById('remote-combobox');
remote_combobox.addEventListener('change', async function() {
    await RemoteCDMManager.saveSelectedRemoteCDM(remote_combobox.options[remote_combobox.selectedIndex].text);
});
// ============================================

// ================ Command Options ================
const use_shaka = document.getElementById('use-shaka');
use_shaka.addEventListener('change', async function (){
    await SettingsManager.saveUseShakaPackager(use_shaka.checked);
});

const downloader_name = document.getElementById('downloader-name');
downloader_name.addEventListener('input', async function (event){
    await SettingsManager.saveExecutableName(downloader_name.value);
});

const set_filename_from_title = document.getElementById('set-filename-from-title');
set_filename_from_title.addEventListener('change', async function () {
    await SettingsManager.saveSetFilenameFromTitle(set_filename_from_title.checked);
});

const use_select_video = document.getElementById('use-select-video');
use_select_video.addEventListener('change', async function (){
    await SettingsManager.saveUseSelectVideo(use_select_video.checked);
});

const select_video_param = document.getElementById('select-video-param');
select_video_param.addEventListener('input', async function (event) {
    await SettingsManager.saveSelectVideoParam(select_video_param.value);
});

const use_select_audio = document.getElementById('use-select-audio');
use_select_audio.addEventListener('change', async function () {
    await SettingsManager.saveUseSelectAudio(use_select_audio.checked);
});

const select_audio_param = document.getElementById('select-audio-param');
select_audio_param.addEventListener('input', async function (event) {
    await SettingsManager.saveSelectAudioParam(select_audio_param.value);
});
// =================================================

// ================ Keys ================
const clear = document.getElementById('clear');
clear.addEventListener('click', async function() {
    chrome.runtime.sendMessage({ type: "CLEAR" });
    key_container.innerHTML = "";
});

async function createCommand(json, key_string, title) {
    const metadata = JSON.parse(json);
    const header_string = Object.entries(metadata.headers).map(([key, value]) => `-H "${key}: ${value.replace(/"/g, "'")}"`).join(' ');
    return `${await SettingsManager.getExecutableName()} "${metadata.url}" ${header_string} ${key_string} ${await SettingsManager.getUseShakaPackager() ? "--use-shaka-packager " : ""}-M format=mkv${await SettingsManager.getSetFilenameFromTitle() && title ? " --save-name ".concat('"', title, '"') : ""}${await SettingsManager.getUseSelectVideo() ? " --select-video ".concat(await SettingsManager.getSelectVideoParam()) : ""}${await SettingsManager.getUseSelectAudio() ? " --select-audio ".concat(await SettingsManager.getSelectAudioParam()) : ""}`;
}

async function appendLog(result) {
    const key_string = result.keys.map(key => `--key ${key.kid}:${key.k}`).join(' ');
    const date = new Date(result.timestamp * 1000);
    const date_string = date.toLocaleString();

    const logContainer = document.createElement('div');
    logContainer.classList.add('log-container');
    logContainer.innerHTML = `
        <button class="toggleButton">+</button>
        <div class="expandableDiv collapsed">
            <label class="always-visible right-bound">
                Title:<input type="text" class="text-box" value="${result.title}">
            </label>
            <label class="always-visible right-bound">
                URL:<input type="text" class="text-box" value="${result.url}">
            </label>
            ${result.manifests.length > 0 ? `<label class="always-visible right-bound command-copy">
                <a href="#" title="Click to copy">Cmd:</a><input type="text" id="command" class="text-box">
            </label>` : ''}
            <label class="expanded-only right-bound">
            <label class="expanded-only right-bound">
                PSSH:<input type="text" class="text-box" value="${result.pssh_data}">
            </label>
            <label class="expanded-only right-bound key-copy">
                <a href="#" title="Click to copy">Keys:</a><input type="text" class="text-box" value="${key_string}">
            </label>
            <label class="expanded-only right-bound">
                Date:<input type="text" class="text-box" value="${date_string}">
            </label>
            ${result.manifests.length > 0 ? `<label class="expanded-only right-bound manifest-copy">
                <a href="#" title="Click to copy">Manifest:</a><select id="manifest" class="text-box"></select>
            </label>` : ''}
        </div>`;

    const keysInput = logContainer.querySelector('.key-copy');
    keysInput.addEventListener('click', () => {
        navigator.clipboard.writeText(key_string);
    });

    if (result.manifests.length > 0) {
        const command = logContainer.querySelector('#command');

        const select = logContainer.querySelector("#manifest");
        select.addEventListener('change', async () => {
            command.value = await createCommand(select.value, key_string, result.title);
        });
        result.manifests.forEach((manifest) => {
            const option = new Option(`[${manifest.type}] ${manifest.url}`, JSON.stringify(manifest), manifest.type.startsWith('HLS'), manifest.type.startsWith('HLS'));
            select.add(option);
        });
        command.value = await createCommand(select.value, key_string, result.title);

        const manifest_copy = logContainer.querySelector('.manifest-copy');
        manifest_copy.addEventListener('click', () => {
            navigator.clipboard.writeText(JSON.parse(select.value).url);
        });

        const command_copy = logContainer.querySelector('.command-copy');
        command_copy.addEventListener('click', () => {
            navigator.clipboard.writeText(command.value);
        });
    }

    const toggleButtons = logContainer.querySelector('.toggleButton');
    toggleButtons.addEventListener('click', function () {
        const expandableDiv = this.nextElementSibling;
        if (expandableDiv.classList.contains('collapsed')) {
            toggleButtons.innerHTML = "-";
            expandableDiv.classList.remove('collapsed');
            expandableDiv.classList.add('expanded');
        } else {
            toggleButtons.innerHTML = "+";
            expandableDiv.classList.remove('expanded');
            expandableDiv.classList.add('collapsed');
        }
    });

    key_container.appendChild(logContainer);
}

chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local') {
        for (const [key, values] of Object.entries(changes)) {
            await appendLog(values.newValue);
        }
    }
});

function checkLogs() {
    chrome.runtime.sendMessage({ type: "GET_LOGS" }, (response) => {
        if (response) {
            response.forEach(async (result) => {
                await appendLog(result);
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', async function () {
    enabled.checked = await SettingsManager.getEnabled();
    SettingsManager.setDarkMode(await SettingsManager.getDarkMode());
    use_shaka.checked = await SettingsManager.getUseShakaPackager();
    downloader_name.value = await SettingsManager.getExecutableName();
    set_filename_from_title.checked = await SettingsManager.getSetFilenameFromTitle();
    use_select_video.checked = await SettingsManager.getUseSelectVideo();
    select_video_param.value = await SettingsManager.getSelectVideoParam();
    use_select_audio.checked = await SettingsManager.getUseSelectAudio();
    select_audio_param.value = await SettingsManager.getSelectAudioParam();

    await SettingsManager.setSelectedDeviceType(await SettingsManager.getSelectedDeviceType());
    await DeviceManager.loadSetAllWidevineDevices();
    await DeviceManager.selectWidevineDevice(await DeviceManager.getSelectedWidevineDevice());
    await RemoteCDMManager.loadSetAllRemoteCDMs();
    await RemoteCDMManager.selectRemoteCDM(await RemoteCDMManager.getSelectedRemoteCDM());
    checkLogs();
});
// ======================================
