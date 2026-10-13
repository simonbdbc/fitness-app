mod features;
mod shared;

use std::net::SocketAddr;

use anyhow::Context;
use axum::{Json, Router, routing::get};
use serde::Serialize;
use sqlx::postgres::PgPoolOptions;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::features::{ai, catalog, level_tests, profiles};
use crate::shared::{config::AppConfig, state::AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "fitness_backend=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = AppConfig::from_env();
    let pool = PgPoolOptions::new()
        .max_connections(config.database_max_connections)
        .connect(&config.database_url)
        .await
        .context("failed to connect to Postgres")?;

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .context("failed to run migrations")?;

    let state = AppState::new(pool, config.clone());
    let app = Router::new()
        .route("/health", get(health))
        .nest("/api/catalog", catalog::routes())
        .nest("/api/profiles", profiles::routes())
        .nest("/api/level-tests", level_tests::routes())
        .nest("/api/ai", ai::routes())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from((config.host, config.port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(%addr, "fitness backend listening");
    axum::serve(listener, app).await?;

    Ok(())
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "fitness-backend",
    })
}
