back_dev:
	cd packages/hocuspocus.server && npm run dev:pg

front_dev:
	cd packages/web && npm run dev

local:
	make -j 2 back_dev front_dev

dev_editor:
	cd packages/web && npm run dev

dev_editor_hocuspocus:
	cd packages/web && npm run hocuspocus:server

editor:
	make -j 2 dev_editor dev_editor_hocuspocus

build:
	cd packages/web && rm -rf dist && npm run build
	cd packages/hocuspocus.server && docker-compose -f docker-compose.prod.yml up

down:
	cd packages/hocuspocus.server && docker-compose -f docker-compose.prod.yml down

fastRun:
	docker-compose -f docker-compose.prod.yml up

build_front:
		cd packages/web && rm -rf dist && npm run build
