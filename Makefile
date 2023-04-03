back_dev:
	cd packages/hocuspocus.server && npm run dev:pg

front_dev:
	cd packages/next.js && npm run dev

local:
	make -j 2 back_dev front_dev

dev_editor:
	cd packages/next.js && npm run dev

dev_editor_hocuspocus:
	cd packages/web && npm run hocuspocus:server

editor:
	make -j 2 dev_editor_hocuspocus dev_editor

build:
	cd packages/web && rm -rf dist && npm run build
	cd packages/hocuspocus.server && docker-compose -f docker-compose.prod.yml up

fastRun:
	docker-compose -f docker-compose.prod.yml up

build_front:
		cd packages/next.js && npm start

build_hocuspocus.server_stage:
		cd packages/hocuspocus.server && docker-compose -p stage-docsplus -f docker-compose.stage.yml up -d

down_stage:
	cd packages/hocuspocus.server && docker-compose -p stage-docsplus -f docker-compose.stage.yml down --rmi local

build_hocuspocus.server_prod:
		cd packages/hocuspocus.server && docker-compose -p prod-docsplus -f docker-compose.prod.yml up -d

down_prod:
	cd packages/hocuspocus.server && docker-compose -p prod-docsplus -f docker-compose.prod.yml down --rmi local
