---
title: Ep2. Splash 이미지 커스터마이징 하기
date: 2025-08-10
tags: [Expo, React Native, iOS, Splash Screen]
author: oscar.rs
---

# Preface

이전에 작성한 [Expo Splash Image](../ep1-splash-image)를 기반으로 스플래쉬 화면에 회사명을 추가할 일이 생겼습니다. 이전 포스트에서 이미지를 네이티브 앱으로 빌드하여 스플래쉬를 추가하는 과정을 설명했는데요. 여기에 덧붙여서 텍스트까지 입힌 스플래쉬 이미지를 추가하는 작업을 진행해야 했습니다.

하지만 이런 경우 작업이 꽤 늘어나는 것을 알게 되었습니다.

# 작업이 늘어나는 이유

우선 간단한 방법으로는 `LaunchScreen.storyboard` 를 수정하는 방법이 있습니다. 하지만 이 방법은 나중에 `rm -rf ios` 명령을 실행하거나 `npx prebuild --clean` 명령을 실행할 때 모든 변경사항이 사라지는 이슈가 있습니다. `Expo` 가 `app.json` 을 기반으로 `ios` 폴더를 새로 만들면서 직접 추가했던 텍스트 라벨도 함께 덮어쓰기 때문입니다.

이를 해결하기 위해 `LaunchScreen.storyboard` 를 수정하는 방법이 아닌 다른 방법을 찾아야 했습니다.

# 그럼 어떻게 해결해야 할까?

이 변경사항을 영구적으로 유지하기 위해 `Expo` 의 `Config Plugin` 을 만들어야 했습니다. `Config Plugin` 은 `prebuild` 가 실행될 때마다 `LaunchScreen.storyboard` 를 <mark>프로그래밍 방식으로 수정하는 스크립트를 의미</mark>합니다.

초급자에게 권장하는 쉬운 방법은 아니지만, Production Ready 상태의 앱을 구성하기 위해 필수적인 작업이었습니다.

# Config Plugin 만들기

여기서 만들어야 할 `Config Plugin` 은 다음의 과정을 거칩니다.

### 1. 마스터 템플릿 구성

우선 마스터 템플릿을 만들어야 합니다. 마스터 템플릿은 기존에 있었던 `LaunchScreen.storyboard` 또는 `SplashScreen.storyboard` 파일을 기반으로 합니다. 기존에 있던 `LaunchScreen.storyboard` 파일에 텍스트(Label)을 추가하고 `Xcode` 를 통해 `LaunchScreen.storyboard` 파일의 디자인을 수정합니다. 수정된 `LaunchScreen.storyboard` 파일을 `<project-root>/assets/splash/` 폴더에 저장해둡니다.

```xml
<subviews>
  <imageView
    clipsSubviews="YES"
    userInteractionEnabled="NO"
    contentMode="scaleAspectFit"
    image="SplashScreenLogo"
    translatesAutoresizingMaskIntoConstraints="NO"
    id="EXPO-SplashScreen"
    userLabel="SplashScreenLogo">
      <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
  </imageView>

  <!-- 텍스트 라벨을 추가하였습니다. -->
  <label
    opaque="NO"
    userInteractionEnabled="NO"
    contentMode="left"
    horizontalHuggingPriority="251"
    verticalHuggingPriority="251"
    fixedFrame="YES"
    text="Moobean"
    textAlignment="center"
    lineBreakMode="tailTruncation"
    baselineAdjustment="alignBaselines"
    adjustsFontSizeToFit="NO"
    preferredMaxLayoutWidth="77"
    translatesAutoresizingMaskIntoConstraints="NO"
    id="moobean-label-id">
      <rect key="frame" x="117" y="512" width="159" height="47"/>
      <autoresizingMask key="autoresizingMask" flexibleMaxX="YES" flexibleMaxY="YES"/>
      <fontDescription key="fontDescription" type="system" pointSize="39"/>
      <nil key="textColor"/>
      <nil key="highlightedColor"/>
  </label>
</subviews>
```

이렇게 구성하면 `LaunchScreen.storyboard` 파일을 기반으로 `Xcode` 에 추가된 텍스트 라벨을 보실 수 있습니다. 이 라벨을 기반으로 `Xcode` 에서 디자인 작업을 진행해주시면 됩니다.


### 2. Config Plugin 작성

디자인 된 `LaunchScreen.storyboard` 파일을 기반으로 `Config Plugin` 을 작성해야 합니다. 우선 `<project-root>/plugins/` 폴더에 `withIosSplashText.js` 파일을 생성합니다.

```javascript
// <project-root>/plugins/withIosSplashText.js
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withIosSplashText = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const appName = modConfig.modRequest.projectName;

      // 1. 마스터 템플릿 파일 경로
      const sourcePath = path.join(
        projectRoot,
        'assets/splash/SplashScreen.storyboard'
      );

      // 2. 덮어쓸 대상 파일 경로 (올바른 이름으로 수정)
      const destinationPath = path.join(
        projectRoot,
        'ios',
        appName,
        'SplashScreen.storyboard'
      );

      if (!fs.existsSync(sourcePath)) {
        throw new Error(
          `Custom splash screen template not found at: ${sourcePath}`
        );
      }

      // 마스터 템플릿으로 Expo 기본 파일을 덮어쓰기
      fs.copyFileSync(sourcePath, destinationPath);

      return modConfig;
    },
  ]);
};

module.exports = withIosSplashText;
```

### 3. app.json 수정

플러그인까지 만들었다면 이제 `app.json` 파일을 수정해야 합니다.

```json
// <project-root>/app.json
{
  ...config
  "plugins": [
      "expo-router",
      // 만든 플러그인을 추가해주세요!
      "./plugins/withIosSplashText.js"
    ],
}
```

### 4. 최종 테스트

마지막으로 기존 `ios` 폴더를 삭제하고 `npx prebuild` 명령어를 실행하여 `ios` 폴더를 새로 만들고, `npx run ios` 명령어를 실행하여 앱을 실행해보세요.

```bash
$ rm -rf ios

$ npx prebuild

$ npx run ios
```

테스트하셔야 할 부분은 `prebuild` 명령어 실행 후 생긴 `ios` 폴더의 `SplashScreen.storyboard` 파일이 커스터마이징이 되어있는 상태로 스플래쉬 화면이 나타나야 정상적으로 동작이 완료된 것 입니다.
