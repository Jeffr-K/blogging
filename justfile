# Quartz 블로그 관리 스크립트

# 기본 명령어 (just 만 실행시)
default:
    @just --list

# 로컬 개발 서버 실행
dev:
    npx quartz build --serve

# 빌드만
build:
    npx quartz build

# Netlify 프리뷰 배포 (테스트용)
preview:
    npx netlify deploy

# Netlify 프로덕션 배포
deploy:
    npx netlify deploy --prod

# Git push + 배포
ship:
    git push origin main
    npx netlify deploy --prod

# 새 글 동기화 (Obsidian content 폴더에서)
sync:
    npx quartz sync
