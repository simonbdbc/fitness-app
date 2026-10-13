use burn::{
    module::Module,
    nn::{Linear, LinearConfig, Relu},
    tensor::{ElementConversion, Tensor, activation::sigmoid, backend::Backend},
};

use crate::{FEATURE_COUNT, SessionScorer};

#[derive(Module, Debug)]
pub struct WorkoutScorer<B: Backend> {
    layer_1: Linear<B>,
    layer_2: Linear<B>,
    activation: Relu,
}

impl<B: Backend> WorkoutScorer<B> {
    pub fn new(device: &B::Device) -> Self {
        Self {
            layer_1: LinearConfig::new(FEATURE_COUNT, 8).init(device),
            layer_2: LinearConfig::new(8, 1).init(device),
            activation: Relu::new(),
        }
    }

    pub fn forward(&self, input: Tensor<B, 2>) -> Tensor<B, 2> {
        let hidden = self.layer_1.forward(input);
        let hidden = self.activation.forward(hidden);
        sigmoid(self.layer_2.forward(hidden))
    }
}

pub struct BurnSessionScorer<B: Backend> {
    model: WorkoutScorer<B>,
    device: B::Device,
}

impl<B: Backend> BurnSessionScorer<B> {
    pub fn new(model: WorkoutScorer<B>, device: B::Device) -> Self {
        Self { model, device }
    }
}

impl<B: Backend> SessionScorer for BurnSessionScorer<B> {
    fn score(&self, features: [f32; FEATURE_COUNT]) -> f32 {
        self.model
            .forward(Tensor::<B, 2>::from_floats([features], &self.device))
            .into_scalar()
            .elem::<f32>()
            .clamp(0.0, 1.0)
    }
}
