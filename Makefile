backend_dev:
	cd backend && npm run dev

frontend_dev:
	cd frontend && npm run dev

build:
	cd frontend && rm -rf dist && npm run build
	docker-compose -f docker-compose.prod.yml up

down:
	cd frontend && rm -rf dist
	docker-compose -f docker-compose.prod.yml down


fastRun:
	docker-compose -f docker-compose.prod.yml up
