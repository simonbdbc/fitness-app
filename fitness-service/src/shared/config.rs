use std::{env, net::IpAddr};

#[derive(Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub database_max_connections: u32,
    pub host: IpAddr,
    pub port: u16,
}

impl AppConfig {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| {
                "postgres://fitness:fitness@localhost:5432/fitness_app".to_owned()
            }),
            database_max_connections: env::var("DATABASE_MAX_CONNECTIONS")
                .ok()
                .and_then(|value| value.parse().ok())
                .unwrap_or(5),
            host: env::var("BACKEND_HOST")
                .ok()
                .and_then(|value| value.parse().ok())
                .unwrap_or_else(|| "127.0.0.1".parse().expect("valid localhost")),
            port: env::var("BACKEND_PORT")
                .ok()
                .and_then(|value| value.parse().ok())
                .unwrap_or(8080),
        }
    }
}
