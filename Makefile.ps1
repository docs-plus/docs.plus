function back_dev {
  Set-Location packages/hocuspocus.server
  npm run dev:postgres
  Set-Location ../..
}

function back_ws {
  Set-Location packages/hocuspocus.server
  npm run dev:ws
  Set-Location ../..
}

function front_dev {
  Set-Location packages/nextjs
  npm run dev
  Set-Location ..
}

function dev_editor {
  Set-Location packages/nextjs
  npm run dev
  Set-Location ..
}

function dev_editor_hocuspocus {
  Set-Location packages/web
  npm run hocuspocus:server
  Set-Location ..
}

function build {
  Set-Location packages/web
  Remove-Item -Recurse -Force dist
  npm run build
  Set-Location ..

  Set-Location packages/hocuspocus.server
  docker-compose -f docker-compose.prod.yml up
  Set-Location ../..
}

function fastRun {
  docker-compose -f docker-compose.prod.yml up
}

function build_front_stage {
  Set-Location packages/nextjs
  npm run build
  npm run start:stage
  Set-Location ..
}

function build_front_production {
  Set-Location packages/nextjs
  npm run build
  npm run start:prod
  Set-Location ..
}

function down_stage {
  Set-Location packages/hocuspocus.server
  $env:ENVIRONMENT = "stage"
  docker-compose -p stage-docsplus down --rmi local
  Set-Location ../..
}

function build_hocuspocus_server_stage {
  down_stage
  Set-Location packages/hocuspocus.server
  $env:ENVIRONMENT = "stage"
  docker-compose -p stage-docsplus build --no-cache
  docker-compose -p stage-docsplus up -d
  Set-Location ../..
}

function down_prod {
  Set-Location packages/hocuspocus.server
  $env:ENVIRONMENT = "prod"
  docker-compose -p prod-docsplus down --rmi local
  Set-Location ../..
}

function build_hocuspocus_server_prod {
  down_prod
  Set-Location packages/hocuspocus.server
  $env:ENVIRONMENT = "prod"
  docker-compose -p prod-docsplus build --no-cache
  docker-compose -p prod-docsplus up -d
  Set-Location ../..
}

function run_local {
  Start-Job -ScriptBlock ${function:back_dev}
  Start-Job -ScriptBlock ${function:back_ws}
  Start-Job -ScriptBlock ${function:front_dev}
}

function run_editor {
  Start-Job -ScriptBlock ${function:dev_editor_hocuspocus}
  Start-Job -ScriptBlock ${function:dev_editor}
}
