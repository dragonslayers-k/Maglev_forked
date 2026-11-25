# 동적 미디어 감지 계약

- 상태: 개발 중
- 대상 브랜치: feature/p1-video-detection-observer
- 기준 원본: Maglev v0.33 / baaf83f0f3afd65d2eac135cce8b8bbabea8fbb3
- 범위: 브라우저 미디어 후보 감지와 기존 Found Files 목록 연동
- 주의: CI·Galaxy 실기기 검증 전이므로 최종 승인된 계약이 아닙니다.

## 1. 목표

페이지의 video 또는 audio 태그에 파일 확장자가 없는 경우에도 응답 MIME과 브라우저 내부 리소스 관찰 결과로 다운로드 후보를 찾습니다. 감지 실패를 줄이는 것이 목표이며 DRM·서비스 권한·브라우저 격리를 우회하지 않습니다.

## 2. 감지 경로

| 경로 | 동작 | 제한 |
|---|---|---|
| Android WebViewClient | 기존 shouldInterceptRequest 요청에서 URL, Accept, Range를 관찰 | 응답을 읽거나 교체하지 않음 |
| Service Worker | Android 7(API 24)+의 ServiceWorkerController를 통해 GET 요청을 관찰 | 프로세스 전역 콜백이므로 활성 브라우저 탭만 대상으로 하며 Referer/Origin 호스트가 현재 페이지와 일치해야 함 |
| DOM | video/audio의 currentSrc, src, source, 해상도 및 이미지 메타데이터를 스캔 | 페이지 메인 프레임만 |
| fetch | 메인 프레임의 GET fetch 완료 후 응답 URL과 Content-Type을 관찰 | 본문을 읽거나 응답 객체를 교체하지 않음. CORS 정책에 의해 응답 헤더가 노출되지 않을 수 있음 |
| XHR | 메인 프레임의 GET 요청에 loadend 관찰자를 추가해 responseURL과 Content-Type을 읽음 | POST/기타 메서드는 감지 경로에서 제외 |
| Resource Timing | 최근 리소스 목록에서 직접 미디어 URL과 매니페스트 후보를 재검사 | 응답 MIME을 보장하지 않으며 사이트가 리소스 정보를 제한할 수 있음 |

## 3. 내부 페이지 보고 형식

기존 단일 브리지 메서드 MaglevScan.report(json)를 유지합니다. 새 JavaScript 인터페이스 메서드는 추가하지 않습니다.

보고 항목 예시:

    {
      "n": "page-nonce",
      "items": [
        {
          "u": "https://cdn.example/video/manifest?id=1",
          "t": "video",
          "w": 1920,
          "h": 1080,
          "m": "application/vnd.apple.mpegurl"
        }
      ]
    }

- n: 현재 문서에 발급된 nonce
- u: 정규화 대상 HTTP(S) URL
- t: video, audio, image, meta-image, meta-video, link
- w, h: 확인된 경우에만 0보다 큰 픽셀 값
- m: 선택적 MIME 값. 128자 이내의 단순 MIME 타입만 허용

네이티브 측에서 JSON 크기, nonce, 항목 수, URL 길이, 타입, MIME 패턴을 검증합니다. 페이지가 보내는 데이터는 신뢰하지 않습니다.

## 4. 분류 우선순위

1. URL 확장자와 기존 FoundClassifier 결과
2. HTTP 응답 MIME
3. video/audio DOM 요소의 종류 힌트

주요 MIME 매핑:

| MIME | 분류 |
|---|---|
| application/vnd.apple.mpegurl | HLS |
| application/x-mpegurl | HLS |
| audio/mpegurl, audio/x-mpegurl | HLS |
| application/dash+xml | DASH |
| video/* | 직접 동영상 후보 |
| audio/* | 직접 오디오 후보 |

확장자나 MIME이 늦게 확인될 수 있으므로 URL ID가 이미 존재하더라도 더 풍부한 MIME, 스트림 종류, 크기, 해상도가 도착하면 기존 항목을 보강합니다. 이미 알려진 정보가 뒤늦은 부분 보고 때문에 지워져서는 안 됩니다.

## 5. 스트림 세그먼트 노이즈

HLS/DASH 매니페스트가 확인되면 .ts, .m4s, .cmfv, .cmfa, video/mp2t 등 알려진 조각 리소스가 파일 목록을 채우는 현상을 억제합니다.

이 필터는 발견 순서에 영향을 받습니다. 매니페스트보다 먼저 보고된 일부 조각 URL까지 모든 상황에서 되돌려 제거한다고 보장하지 않습니다. 실기기 테스트에서 세그먼트 노이즈를 확인하고 보완합니다.

## 6. 요청 헤더와 쿠키

현재 다운로드 시트는 기존 구현을 사용합니다.

- 다운로드 URL 자체의 CookieManager 쿠키
- 페이지 호스트와 미디어 호스트별 쿠키 목록
- Referer, Origin, User-Agent

쿠키를 페이지 JavaScript 보고에 포함하지 않습니다. 쿠키·인증 헤더를 로그나 감지 이벤트에 저장하지 않습니다. 외부 Chrome·Samsung Internet의 브라우저 쿠키 저장소는 Android 앱 샌드박스 경계 때문에 자동으로 가져오지 않습니다. 외부 브라우저 공유는 URL 전달로 취급하며, 로그인 세션이 필요한 경우 앱 내부 브라우저에서 직접 인증해야 할 수 있습니다.

Sec-Fetch-* 및 Accept-Language 헤더는 아직 원본 브라우저 요청과 동등하게 재현하지 않습니다. 값이 확인되지 않은 헤더를 추측해 위조하지 않습니다.

## 7. 보안 경계와 알려진 한계

- DRM/EME 감지는 유지하며 복호화·라이선스 우회는 수행하지 않습니다.
- JavaScript 감지 코드는 메인 프레임에 주입됩니다. 교차 출처 iframe 내부 리소스를 모두 관찰하지 못할 수 있습니다.
- fetch/XHR 래퍼는 페이지 스크립트가 자체 구현을 교체하거나 요청을 다른 실행 컨텍스트로 옮기면 관찰하지 못할 수 있습니다.
- Service Worker 요청 콜백은 WebView 프로세스 전역 API입니다. Referer/Origin이 없거나 현재 페이지와 맞지 않으면 의도적으로 감지하지 않습니다.
- MSE/blob URL은 실제 세그먼트 주소가 노출되지 않으면 저장 가능한 원본 URL로 변환할 수 없습니다.
- 만료 토큰, 서버 접근 제한, 인증 만료, CORS 및 DRM 보호는 감지·다운로드를 제한할 수 있습니다.
- 감지된 URL이 저장 권한을 의미하지는 않습니다. 사용자는 콘텐츠의 접근 권한과 관련 법규를 준수해야 합니다.

## 8. 승인 기준

- MIME 기반 extensionless HLS/DASH/direct video 테스트 통과
- fetch/XHR/Resource Timing 감지 회귀 테스트 통과
- Service Worker 활성 탭·비활성 탭 분리 테스트 통과
- 보고 JSON 검증 및 MIME 길이 제한 테스트 통과
- 기존 Browser, Found Files, StreamSheet, Rust stream contract 회귀 테스트 통과
- PR CI 전체 녹색
- Galaxy에서 QA 문서의 필수 시나리오 수행
