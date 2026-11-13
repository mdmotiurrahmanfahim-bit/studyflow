# STUDYFLOW — Student Academic Planner

## 1. Run the web version on Windows
1. Install Node.js LTS: https://nodejs.org/
2. Extract this ZIP.
3. Open the `student-academic-planner` folder.
4. Click the File Explorer address bar, type `cmd`, and press Enter.
5. Run `npm install`.
6. Run `npx expo start --web`.
7. Open the local URL shown in the terminal (usually http://localhost:8081).

## 2. Build an installable Android APK
1. Create a free Expo account: https://expo.dev/signup
2. In the same project folder, run `npm install`.
3. Install EAS CLI: `npm install -g eas-cli`
4. Sign in: `eas login`
5. Build the APK: `eas build --platform android --profile preview`
6. If asked to create an EAS project, answer yes. If asked about Android signing credentials, allow EAS to generate them.
7. Wait for the cloud build to finish. Open the build URL printed in the terminal, download the APK on your Android phone, and install it. You may need to allow installation from your browser/downloads app.

## Important limitations
- The project currently stores data locally; web and phone do not sync yet.
- Android scheduled notifications are included, but a guaranteed full-screen alarm-clock experience with exact timing and reboot recovery needs additional native Android work.
- Web notifications cannot guarantee ringing while the browser is closed or the device is asleep.
- This is a starter project, not yet a production-ready store release.
