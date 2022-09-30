back_dev:
	cd packages/hocuspocus.server && npm run dev:pg

front_dev:
	cd packages/web && npm run dev

build:
	cd packages/web && rm -rf dist && npm run build
	cd packages/hocuspocus.server && docker-compose -f docker-compose.prod.yml up

down:
	cd packages/hocuspocus.server && docker-compose -f docker-compose.prod.yml down

fastRun:
	docker-compose -f docker-compose.prod.yml up

build_front:
		cd packages/web && rm -rf dist && npm run build
